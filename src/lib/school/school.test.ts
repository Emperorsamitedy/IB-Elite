import { describe, expect, it } from "vitest";
import {
  ACTIVE_FLOOR,
  MEMBER_CAP,
  pointsForEvent,
  schoolScore,
} from "./scoring";
import { detectLeadChange, pairRivals } from "./rivalry";

const members = (n: number, points: number) =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, points }));

describe("school scoring", () => {
  it("a smaller engaged school beats a larger passive one", () => {
    const small = schoolScore(members(60, 50)); // 60 active at 50pts
    const large = schoolScore([
      ...members(200, 20), // 200 active at 20pts
      ...members(1800, 0), // 1800 inactive
    ]);
    expect(small.score).toBeGreaterThan(large.score);
  });

  it("caps any individual contribution", () => {
    const oneHero = schoolScore([{ userId: "hero", points: 100_000 }]);
    const capped = schoolScore([{ userId: "hero", points: MEMBER_CAP }]);
    expect(oneHero.score).toBe(capped.score);
  });

  it("a lone superstar cannot beat a modest active cohort", () => {
    const superstar = schoolScore([{ userId: "hero", points: 100_000 }]);
    const cohort = schoolScore(members(20, 40));
    expect(cohort.score).toBeGreaterThan(superstar.score);
  });

  it("activating another classmate always helps below the floor", () => {
    const before = schoolScore(members(4, 40));
    const after = schoolScore([...members(4, 40), { userId: "new", points: 30 }]);
    expect(after.score).toBeGreaterThan(before.score);
    expect(ACTIVE_FLOOR).toBeGreaterThan(4);
  });

  it("breadth boost rewards mass participation at equal averages", () => {
    const thirty = schoolScore(members(30, 50));
    const twoHundred = schoolScore(members(200, 50));
    expect(twoHundred.score).toBeGreaterThan(thirty.score);
  });

  it("inactive members never dilute the average", () => {
    const active = schoolScore(members(30, 50));
    const withLurkers = schoolScore([...members(30, 50), ...members(500, 0)]);
    expect(withLurkers.score).toBe(active.score);
    expect(withLurkers.activeMembers).toBe(30);
  });
});

describe("event points", () => {
  it("scores duels by result and ignores friendlies", () => {
    expect(pointsForEvent("duel_result", { result: "won" })).toBe(5);
    expect(pointsForEvent("duel_result", { result: "lost" })).toBe(2);
    expect(
      pointsForEvent("duel_result", { result: "won", mode: "friendly" }),
    ).toBe(0);
  });

  it("scores mocks by percentile, unranked sits still count a little", () => {
    expect(
      pointsForEvent("mock_result", { ranked: true, globalPercentile: 90 }),
    ).toBe(23);
    expect(pointsForEvent("mock_result", { ranked: false })).toBe(2);
  });

  it("scores practice by mark share and unknown kinds zero", () => {
    expect(pointsForEvent("practice_result", { awarded: 8, total: 10 })).toBe(3);
    expect(pointsForEvent("signal_thing", {})).toBe(0);
  });
});

describe("rivalry pairing", () => {
  const school = (id: string, score: number, country: string | null) => ({
    schoolId: id,
    score,
    country,
  });

  it("pairs neighbours by rank, preferring the same country nearby", () => {
    const pairs = pairRivals([
      school("a", 100, "ET"),
      school("b", 95, "GB"),
      school("c", 90, "ET"),
      school("d", 85, "GB"),
    ]);
    // a prefers c (same country within window) over adjacent b.
    expect(pairs).toContainEqual({ schoolA: "a", schoolB: "c" });
    expect(pairs).toContainEqual({ schoolA: "b", schoolB: "d" });
  });

  it("never double-books a school and sits out the odd one", () => {
    const pairs = pairRivals([
      school("a", 100, null),
      school("b", 90, null),
      school("c", 80, null),
    ]);
    expect(pairs).toHaveLength(1);
    const used = pairs.flatMap((p) => [p.schoolA, p.schoolB]);
    expect(new Set(used).size).toBe(used.length);
  });

  it("handles empty and single-school lists", () => {
    expect(pairRivals([])).toEqual([]);
    expect(pairRivals([school("a", 1, null)])).toEqual([]);
  });
});

describe("lead changes", () => {
  it("fires only on a flip, not on repeats or ties", () => {
    expect(detectLeadChange(10, 5, null)).toEqual({ newLeader: "a" });
    expect(detectLeadChange(10, 5, "a")).toBeNull();
    expect(detectLeadChange(4, 5, "a")).toEqual({ newLeader: "b" });
    expect(detectLeadChange(5, 5, "b")).toBeNull();
  });
});
