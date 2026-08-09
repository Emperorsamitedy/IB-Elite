import {
  DEADLINE_SHARE,
  DEFAULT_DAILY_CAP_MINUTES,
  HL_WEIGHT,
  MIN_BLOCK_MINUTES,
  SL_WEIGHT,
  WEAK_MASTERY_THRESHOLD,
  type Deadline,
  type PlanInput,
  type StudentSubject,
  type StudyBlockDraft,
  type TopicMastery,
} from "./types";

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function eachDay(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const end = new Date(`${endDate}T00:00:00Z`);
  const cursor = new Date(`${startDate}T00:00:00Z`);
  while (cursor <= end) {
    days.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function weightOf(subject: StudentSubject): number {
  return subject.level === "HL" ? HL_WEIGHT : SL_WEIGHT;
}

/** Weak topics first (lowest mastery), so early days cover them. */
function topicQueue(
  subjectId: string,
  topics: TopicMastery[],
): TopicMastery[] {
  return topics
    .filter((t) => t.subjectId === subjectId)
    .slice()
    .sort((a, b) => a.mastery - b.mastery || a.topicId.localeCompare(b.topicId));
}

function isDeadlineWork(deadline: Deadline): boolean {
  return deadline.type === "IA" || deadline.type === "EE" || deadline.type === "TOK";
}

/** Splits minutes proportionally to weights using largest remainder. */
function splitMinutes(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const whole = exact.map((m) => Math.floor(m));
  let spare = total - whole.reduce((a, b) => a + b, 0);
  const order = exact
    .map((m, i) => ({ i, frac: m - whole[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (spare <= 0) break;
    whole[i] += 1;
    spare -= 1;
  }
  return whole;
}

/**
 * Pure planner: given a student's subjects, topic mastery and deadlines,
 * returns the study blocks for every day from startDate to examDate.
 * No day exceeds the daily cap, HL subjects receive 1.5x the SL time, weak
 * topics are front-loaded, and deadline work never lands after its due date.
 */
export function buildPlan(input: PlanInput): StudyBlockDraft[] {
  const cap = input.dailyCapMinutes ?? DEFAULT_DAILY_CAP_MINUTES;
  const reserved = input.reservedMinutesByDate ?? {};
  const subjects = input.subjects
    .slice()
    .sort((a, b) => a.subjectId.localeCompare(b.subjectId));
  const queues = new Map(
    subjects.map((s) => [s.subjectId, topicQueue(s.subjectId, input.topics)]),
  );
  const deadlineWork = input.deadlines
    .filter(isDeadlineWork)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

  const blocks: StudyBlockDraft[] = [];

  eachDay(input.startDate, input.examDate).forEach((date, dayIndex) => {
    const capacity = cap - (reserved[date] ?? 0);
    if (capacity < MIN_BLOCK_MINUTES) return;

    // Deadline work only while the deadline is still ahead.
    const due = deadlineWork.filter((d) => d.dueDate >= date);
    let deadlineBudget = 0;
    if (due.length > 0) {
      deadlineBudget = Math.min(
        Math.floor(capacity * DEADLINE_SHARE),
        capacity - MIN_BLOCK_MINUTES,
      );
      if (deadlineBudget < MIN_BLOCK_MINUTES) deadlineBudget = 0;
    }

    if (deadlineBudget > 0) {
      // One deadline per day, rotating, so each keeps progressing.
      const deadline = due[dayIndex % due.length];
      blocks.push({
        date,
        subjectId: deadline.subjectId,
        topicId: null,
        deadlineId: deadline.id,
        allocatedMinutes: deadlineBudget,
      });
    }

    const remaining = capacity - deadlineBudget;
    if (remaining < MIN_BLOCK_MINUTES || subjects.length === 0) return;

    const shares = splitMinutes(
      remaining,
      subjects.map(weightOf),
    );
    subjects.forEach((subject, i) => {
      const minutes = shares[i];
      if (minutes < MIN_BLOCK_MINUTES) return;
      const queue = queues.get(subject.subjectId) ?? [];
      const weak = queue.filter((t) => t.mastery < WEAK_MASTERY_THRESHOLD);
      const pool = weak.length > 0 ? weak : queue;
      const topic = pool.length > 0 ? pool[dayIndex % pool.length] : null;
      blocks.push({
        date,
        subjectId: subject.subjectId,
        topicId: topic?.topicId ?? null,
        deadlineId: null,
        allocatedMinutes: minutes,
      });
    });
  });

  return blocks;
}
