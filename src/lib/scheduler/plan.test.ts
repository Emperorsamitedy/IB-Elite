import { describe, expect, it } from "vitest";
import { buildPlan, eachDay } from "./plan";
import {
  DEFAULT_DAILY_CAP_MINUTES,
  HL_WEIGHT,
  type Deadline,
  type StudentSubject,
  type StudyBlockDraft,
  type TopicMastery,
} from "./types";

const START = "2026-01-01";
const EXAM = "2026-01-21";

const SUBJECTS: StudentSubject[] = [
  { subjectId: "hl-1", level: "HL" },
  { subjectId: "hl-2", level: "HL" },
  { subjectId: "hl-3", level: "HL" },
  { subjectId: "sl-1", level: "SL" },
  { subjectId: "sl-2", level: "SL" },
  { subjectId: "sl-3", level: "SL" },
];

/** Two mastered topics per subject, so nothing counts as weak. */
const STRONG_TOPICS: TopicMastery[] = SUBJECTS.flatMap((s) => [
  { topicId: `${s.subjectId}-a`, subjectId: s.subjectId, mastery: 0.9 },
  { topicId: `${s.subjectId}-b`, subjectId: s.subjectId, mastery: 0.8 },
]);

function minutesByDate(blocks: StudyBlockDraft[]) {
  const totals: Record<string, number> = {};
  for (const b of blocks) totals[b.date] = (totals[b.date] ?? 0) + b.allocatedMinutes;
  return totals;
}

function minutesForSubjects(blocks: StudyBlockDraft[], level: "hl" | "sl") {
  return blocks
    .filter((b) => b.subjectId?.startsWith(level))
    .reduce((sum, b) => sum + b.allocatedMinutes, 0);
}

describe("buildPlan", () => {
  it("covers every day, respects the cap and gives HL 1.5x SL time", () => {
    const blocks = buildPlan({
      subjects: SUBJECTS,
      topics: STRONG_TOPICS,
      deadlines: [],
      startDate: START,
      examDate: EXAM,
    });

    const days = eachDay(START, EXAM);
    const totals = minutesByDate(blocks);
    expect(Object.keys(totals).sort()).toEqual(days);
    for (const day of days) {
      expect(totals[day]).toBeGreaterThan(0);
      expect(totals[day]).toBeLessThanOrEqual(DEFAULT_DAILY_CAP_MINUTES);
    }

    const hlAverage = minutesForSubjects(blocks, "hl") / 3;
    const slAverage = minutesForSubjects(blocks, "sl") / 3;
    expect(hlAverage / slAverage).toBeCloseTo(HL_WEIGHT, 5);
  });

  it("front-loads a newly weak topic without disturbing past or locked days", () => {
    const original = buildPlan({
      subjects: SUBJECTS,
      topics: STRONG_TOPICS,
      deadlines: [],
      startDate: START,
      examDate: EXAM,
    });

    // Rebalance mid-way: days before `todayish` and one locked day stay put.
    const todayish = "2026-01-08";
    const lockedDay = "2026-01-10";
    const lockedBlocks = original.filter((b) => b.date === lockedDay).slice(0, 1);
    const lockedMinutes = lockedBlocks[0].allocatedMinutes;

    const past = original.filter((b) => b.date < todayish);
    const weakened: TopicMastery[] = STRONG_TOPICS.map((t) =>
      t.topicId === "hl-2-b" ? { ...t, mastery: 0 } : t,
    );

    const future = buildPlan({
      subjects: SUBJECTS,
      topics: weakened,
      deadlines: [],
      startDate: todayish,
      examDate: EXAM,
      reservedMinutesByDate: { [lockedDay]: lockedMinutes },
    });

    // Past days are byte-for-byte identical.
    expect(JSON.stringify(past)).toEqual(
      JSON.stringify(original.filter((b) => b.date < todayish)),
    );
    // Nothing was scheduled before today.
    expect(future.every((b) => b.date >= todayish)).toBe(true);
    // The locked block's minutes are still reserved, so the day stays within cap.
    const lockedDayTotal =
      minutesByDate(future)[lockedDay] + lockedMinutes;
    expect(lockedDayTotal).toBeLessThanOrEqual(DEFAULT_DAILY_CAP_MINUTES);
    // The weak topic is now the one scheduled for its subject.
    const hl2 = future.filter((b) => b.subjectId === "hl-2");
    expect(hl2.every((b) => b.topicId === "hl-2-b")).toBe(true);
  });

  it("never schedules IA work after its due date", () => {
    const due = "2026-01-11"; // 10 days out from START
    const deadlines: Deadline[] = [
      {
        id: "ia-1",
        type: "IA",
        subjectId: "hl-1",
        dueDate: due,
        title: "Physics IA",
      },
    ];

    const blocks = buildPlan({
      subjects: SUBJECTS,
      topics: STRONG_TOPICS,
      deadlines,
      startDate: START,
      examDate: EXAM,
    });

    const iaBlocks = blocks.filter((b) => b.deadlineId === "ia-1");
    expect(iaBlocks.length).toBeGreaterThan(0);
    expect(iaBlocks.every((b) => b.date <= due)).toBe(true);
    for (const total of Object.values(minutesByDate(blocks))) {
      expect(total).toBeLessThanOrEqual(DEFAULT_DAILY_CAP_MINUTES);
    }
  });
});
