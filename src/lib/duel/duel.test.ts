import { describe, expect, it } from "vitest";
import { gradeAnswer, isDuelGradable } from "./answers";
import {
  ELO_INITIAL,
  expectedScore,
  leagueFor,
  softReset,
  updateElo,
} from "./elo";
import {
  decideMatch,
  elapsedWithinBudget,
  perQuestionBudgetMs,
} from "./scoring";
import { pickOpponent, windowFor, MAX_WINDOW } from "./matchmaking";
import { previousSeasonSlug, seasonBounds, seasonSlug } from "./season";
import { flagSide, shouldQuarantine } from "./integrity";

describe("gradeAnswer", () => {
  it("grades MCQ by option index", () => {
    const key = { options: ["a", "b", "c"], correct: 2 };
    expect(gradeAnswer("mcq", key, "2")).toBe(true);
    expect(gradeAnswer("mcq", key, "1")).toBe(false);
    expect(gradeAnswer("mcq", key, "banana")).toBe(false);
  });

  it("grades numeric within tolerance", () => {
    const key = { value: 9.81, tolerance: 0.01 };
    expect(gradeAnswer("numeric", key, "9.81")).toBe(true);
    expect(gradeAnswer("numeric", key, "9.815")).toBe(true);
    expect(gradeAnswer("numeric", key, "9.83")).toBe(false);
    expect(gradeAnswer("numeric", key, "1,000")).toBe(false);
    expect(gradeAnswer("numeric", { value: 1000, tolerance: 0 }, "1,000")).toBe(
      true,
    );
  });

  it("grades exact ignoring case and whitespace", () => {
    const key = { accept: ["x = 2", "2"] };
    expect(gradeAnswer("exact", key, "X=2")).toBe(true);
    expect(gradeAnswer("exact", key, " 2 ")).toBe(true);
    expect(gradeAnswer("exact", key, "x=3")).toBe(false);
  });

  // A malformed key must mark wrong, never crash a live match.
  it("never throws on malformed keys or empty answers", () => {
    expect(gradeAnswer("mcq", null, "1")).toBe(false);
    expect(gradeAnswer("numeric", { value: "not-a-number" }, "5")).toBe(false);
    expect(gradeAnswer("exact", { accept: "not-an-array" }, "x")).toBe(false);
    expect(gradeAnswer("exact", { accept: ["x"] }, "   ")).toBe(false);
    expect(gradeAnswer("free", { anything: true }, "essay")).toBe(false);
  });

  it("only structured questions are duel-gradable", () => {
    expect(isDuelGradable("mcq", { correct: 0 })).toBe(true);
    expect(isDuelGradable("free", { accept: [] })).toBe(false);
    expect(isDuelGradable("exact", null)).toBe(false);
  });
});

describe("elo", () => {
  it("is zero-sum for equal ratings and K", () => {
    const a = updateElo(1200, 1200, 1);
    const b = updateElo(1200, 1200, 0);
    expect(a - ELO_INITIAL).toBe(-(b - ELO_INITIAL));
    expect(a).toBe(1216);
  });

  it("awards more for beating a stronger opponent", () => {
    const upset = updateElo(1200, 1500, 1) - 1200;
    const expected = updateElo(1500, 1200, 1) - 1500;
    expect(upset).toBeGreaterThan(expected);
  });

  it("expected score is symmetric", () => {
    expect(expectedScore(1400, 1200) + expectedScore(1200, 1400)).toBeCloseTo(1);
  });

  it("soft reset pulls halfway to the anchor from both sides", () => {
    expect(softReset(1800)).toBe(1500);
    expect(softReset(1000)).toBe(1100);
    expect(softReset(1200)).toBe(1200);
  });

  it("maps ratings to leagues from Bronze to Grandmaster", () => {
    expect(leagueFor(900)).toBe("Bronze");
    expect(leagueFor(1100)).toBe("Silver");
    expect(leagueFor(1299)).toBe("Silver");
    expect(leagueFor(1750)).toBe("Diamond");
    expect(leagueFor(2400)).toBe("Grandmaster");
  });
});

describe("decideMatch", () => {
  const side = (studentId: string, correct: number, totalTimeMs: number) => ({
    studentId,
    correct,
    totalTimeMs,
  });

  it("accuracy beats speed", () => {
    const verdict = decideMatch(side("a", 4, 400_000), side("b", 3, 10_000));
    expect(verdict).toMatchObject({ kind: "winner", winnerId: "a" });
  });

  it("speed breaks accuracy ties", () => {
    const verdict = decideMatch(side("a", 3, 120_000), side("b", 3, 90_000));
    expect(verdict).toMatchObject({ kind: "winner", winnerId: "b", onTime: true });
  });

  it("identical accuracy and time is a draw", () => {
    expect(decideMatch(side("a", 3, 90_000), side("b", 3, 90_000))).toEqual({
      kind: "draw",
    });
  });
});

describe("timing budget", () => {
  it("splits the match limit across questions", () => {
    expect(perQuestionBudgetMs(450, 5)).toBe(90_000);
  });

  it("caps elapsed at the budget and marks late answers", () => {
    const late = elapsedWithinBudget(
      "2026-09-01T10:00:00.000Z",
      "2026-09-01T10:02:00.000Z",
      90_000,
    );
    expect(late).toEqual({ elapsedMs: 90_000, onTime: false });

    const fine = elapsedWithinBudget(
      "2026-09-01T10:00:00.000Z",
      "2026-09-01T10:00:30.000Z",
      90_000,
    );
    expect(fine).toEqual({ elapsedMs: 30_000, onTime: true });
  });

  // A clock skew must never produce a negative elapsed time.
  it("clamps negative elapsed to zero", () => {
    const skewed = elapsedWithinBudget(
      "2026-09-01T10:00:05.000Z",
      "2026-09-01T10:00:00.000Z",
      90_000,
    );
    expect(skewed.elapsedMs).toBe(0);
  });
});

describe("matchmaking", () => {
  const at = (secondsAgo: number, now: Date) =>
    new Date(now.getTime() - secondsAgo * 1000).toISOString();

  it("widens the window over time up to the cap", () => {
    expect(windowFor(0)).toBe(100);
    expect(windowFor(30)).toBe(200);
    expect(windowFor(600)).toBe(MAX_WINDOW);
  });

  it("prefers the closest rating both windows accept", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const seeker = { userId: "s", elo: 1500, enqueuedAt: at(0, now) };
    const close = { userId: "a", elo: 1460, enqueuedAt: at(5, now) };
    const far = { userId: "b", elo: 1340, enqueuedAt: at(5, now) };
    expect(pickOpponent(seeker, [far, close], now)?.userId).toBe("a");
  });

  it("requires the gap to fit BOTH players' windows", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    // Seeker has waited long enough for a 300-gap, candidate has not.
    const seeker = { userId: "s", elo: 1500, enqueuedAt: at(90, now) };
    const fresh = { userId: "a", elo: 1250, enqueuedAt: at(0, now) };
    expect(pickOpponent(seeker, [fresh], now)).toBeNull();
    // Once the candidate has waited too, the pair forms.
    const waited = { ...fresh, enqueuedAt: at(60, now) };
    expect(pickOpponent(seeker, [waited], now)?.userId).toBe("a");
  });

  it("never pairs a player with themselves", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const seeker = { userId: "s", elo: 1500, enqueuedAt: at(10, now) };
    expect(pickOpponent(seeker, [seeker], now)).toBeNull();
  });
});

describe("seasons", () => {
  it("uses UTC calendar months", () => {
    const date = new Date("2026-09-15T23:30:00Z");
    expect(seasonSlug(date)).toBe("2026-09");
    const { startsAt, endsAt } = seasonBounds(date);
    expect(startsAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("rolls the previous slug across year boundaries", () => {
    expect(previousSeasonSlug("2026-01")).toBe("2025-12");
    expect(previousSeasonSlug("2026-09")).toBe("2026-08");
  });
});

describe("integrity flags", () => {
  const fast = { elapsedMs: 1000, correct: true };
  const normal = { elapsedMs: 45_000, correct: true };
  const miss = { elapsedMs: 30_000, correct: false };

  it("flags multiple sub-human correct answers", () => {
    const flags = flagSide([fast, fast, normal, miss, miss], null);
    expect(flags.map((f) => f.code)).toContain("impossible_speed");
    expect(shouldQuarantine(flags)).toBe(true);
  });

  it("flags perfect scores at implausible mean speed", () => {
    const flags = flagSide([{ elapsedMs: 4000, correct: true }, fast], null);
    expect(flags.map((f) => f.code)).toContain("speed_accuracy_outlier");
  });

  it("does not flag an honest slow perfect score", () => {
    expect(flagSide([normal, normal, normal], null)).toEqual([]);
  });

  it("history deviation flags but does not quarantine alone", () => {
    const flags = flagSide([normal, normal, normal, normal], 0.3);
    expect(flags.map((f) => f.code)).toEqual(["history_deviation"]);
    expect(shouldQuarantine(flags)).toBe(false);
  });

  it("never flags new players for lack of history", () => {
    expect(flagSide([normal, normal], null)).toEqual([]);
  });
});
