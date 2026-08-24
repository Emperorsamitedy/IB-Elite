import { describe, expect, it } from "vitest";
import {
  isLate,
  sittingPhase,
  submissionDeadline,
  SUBMIT_GRACE_MS,
} from "./windows";
import { percentileRank, rankOf, topDecileByCriterion } from "./percentiles";
import { flagMockEntry, shouldQuarantineMock } from "./integrity";

const SITTING = {
  opens_at: "2026-09-05T16:00:00Z",
  closes_at: "2026-09-05T18:30:00Z",
  status: "scheduled" as const,
};

describe("sitting windows", () => {
  it("moves upcoming → open → closed on server time", () => {
    expect(sittingPhase(SITTING, new Date("2026-09-05T15:59:59Z"))).toBe("upcoming");
    expect(sittingPhase(SITTING, new Date("2026-09-05T16:00:00Z"))).toBe("open");
    expect(sittingPhase(SITTING, new Date("2026-09-05T18:30:00Z"))).toBe("closed");
  });

  it("a cancelled sitting is cancelled regardless of time", () => {
    expect(
      sittingPhase({ ...SITTING, status: "cancelled" }, new Date("2026-09-05T17:00:00Z")),
    ).toBe("cancelled");
  });

  // The student's own clock runs from THEIR start, but the hall still closes.
  it("deadline is min(own duration, hall close)", () => {
    const early = submissionDeadline("2026-09-05T16:00:00Z", 90, SITTING.closes_at);
    expect(early.toISOString()).toBe("2026-09-05T17:30:00.000Z");
    const lateStart = submissionDeadline("2026-09-05T17:45:00Z", 90, SITTING.closes_at);
    expect(lateStart.toISOString()).toBe("2026-09-05T18:30:00.000Z");
  });

  it("grace covers upload time, not extra writing", () => {
    const startedAt = "2026-09-05T16:00:00Z";
    const deadline = submissionDeadline(startedAt, 90, SITTING.closes_at).getTime();
    expect(
      isLate(new Date(deadline + SUBMIT_GRACE_MS), startedAt, 90, SITTING.closes_at),
    ).toBe(false);
    expect(
      isLate(new Date(deadline + SUBMIT_GRACE_MS + 1000), startedAt, 90, SITTING.closes_at),
    ).toBe(true);
  });
});

describe("percentiles", () => {
  it("computes standard percentile rank with ties", () => {
    // scores include the student's own
    expect(percentileRank([10, 20, 30, 40, 50], 50)).toBe(80);
    expect(percentileRank([10, 20, 30, 40, 50], 10)).toBe(0);
    expect(percentileRank([10, 20, 30, 30, 50], 30)).toBe(50);
  });

  it("degenerate cohorts still return a defined value", () => {
    expect(percentileRank([42], 42)).toBe(0);
    expect(percentileRank([], 42)).toBe(50);
  });

  it("ranks 1-based with shared ranks on ties", () => {
    expect(rankOf([50, 40, 40, 10], 50)).toBe(1);
    expect(rankOf([50, 40, 40, 10], 40)).toBe(2);
    expect(rankOf([50, 40, 40, 10], 10)).toBe(4);
  });

  it("top-decile means cover at least one entry and each criterion", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      total: i,
      criteria: [
        { criterionId: "a", awarded: i % 5 },
        { criterionId: "b", awarded: 2 },
      ],
    }));
    const top = topDecileByCriterion(entries);
    // top decile of 20 = 2 entries (totals 19, 18 → awards 4, 3)
    expect(top.get("a")).toBe(3.5);
    expect(top.get("b")).toBe(2);
    expect(topDecileByCriterion([])).toEqual(new Map());
  });
});

describe("mock integrity", () => {
  const base = {
    durationMinutes: 90,
    startedAt: "2026-09-05T16:00:00Z",
    transcriptLength: 900,
    historyScoreShare: null,
  };

  it("flags a high score written impossibly fast", () => {
    const flags = flagMockEntry({
      ...base,
      submittedAt: "2026-09-05T16:08:00Z", // 8 of 90 minutes
      scoreShare: 0.85,
    });
    expect(flags.map((f) => f.code)).toContain("impossible_write_speed");
    expect(shouldQuarantineMock(flags)).toBe(true);
  });

  it("does not flag a fast but weak script", () => {
    expect(
      flagMockEntry({
        ...base,
        submittedAt: "2026-09-05T16:08:00Z",
        scoreShare: 0.2,
      }),
    ).toEqual([]);
  });

  it("flags a near-empty transcript that still scored", () => {
    const flags = flagMockEntry({
      ...base,
      transcriptLength: 5,
      submittedAt: "2026-09-05T17:20:00Z",
      scoreShare: 0.5,
    });
    expect(flags.map((f) => f.code)).toContain("empty_script_scored");
    expect(shouldQuarantineMock(flags)).toBe(true);
  });

  it("history outlier flags for review without quarantining", () => {
    const flags = flagMockEntry({
      ...base,
      submittedAt: "2026-09-05T17:20:00Z",
      scoreShare: 0.9,
      historyScoreShare: 0.3,
    });
    expect(flags.map((f) => f.code)).toEqual(["score_history_outlier"]);
    expect(shouldQuarantineMock(flags)).toBe(false);
  });

  it("never flags an honest full-time script", () => {
    expect(
      flagMockEntry({
        ...base,
        submittedAt: "2026-09-05T17:25:00Z",
        scoreShare: 0.95,
      }),
    ).toEqual([]);
  });
});
