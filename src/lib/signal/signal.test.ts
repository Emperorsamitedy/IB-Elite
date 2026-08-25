import { describe, expect, it } from "vitest";
import {
  calibrationAccuracy,
  computeSignal,
  eventValue,
  signalToGrade,
  verificationTier,
  type LedgerEvent,
} from "./rating";

function event(
  kind: string,
  payload: Record<string, unknown>,
  daysAgo = 0,
  quarantined = false,
): LedgerEvent {
  return {
    kind,
    payload,
    quarantined,
    created_at: new Date(
      Date.UTC(2026, 8, 20) - daysAgo * 864e5,
    ).toISOString(),
  };
}

describe("eventValue", () => {
  it("normalizes each evidence kind to 0-100", () => {
    expect(eventValue(event("mock_result", { ranked: true, globalPercentile: 80 }))).toBe(80);
    expect(eventValue(event("duel_result", { eloAfter: 1400 }))).toBe(50);
    expect(eventValue(event("practice_result", { awarded: 3, total: 4 }))).toBe(75);
  });

  it("excludes quarantined, friendly, and unranked evidence", () => {
    expect(eventValue(event("mock_result", { ranked: true, globalPercentile: 90 }, 0, true))).toBeNull();
    expect(eventValue(event("duel_result", { eloAfter: 1900, mode: "friendly" }))).toBeNull();
    expect(eventValue(event("mock_result", { ranked: false }))).toBeNull();
    expect(eventValue(event("practice_result", { awarded: 1, total: 0 }))).toBeNull();
  });
});

describe("computeSignal", () => {
  it("returns null with no rateable evidence", () => {
    expect(computeSignal([])).toBeNull();
    expect(computeSignal([event("duel_result", { mode: "friendly" })])).toBeNull();
  });

  it("weights mocks above duels above practice", () => {
    const highMock = computeSignal([
      event("mock_result", { ranked: true, globalPercentile: 90 }),
      event("practice_result", { awarded: 0, total: 10 }),
    ])!;
    const highPractice = computeSignal([
      event("mock_result", { ranked: true, globalPercentile: 0 }),
      event("practice_result", { awarded: 10, total: 10 }),
    ])!;
    expect(highMock.rating).toBeGreaterThan(highPractice.rating);
  });

  // A rating from two sittings must visibly carry less weight than ten.
  it("confidence grows with sample size and evidence diversity", () => {
    const two = computeSignal([
      event("mock_result", { ranked: true, globalPercentile: 70 }, 2),
      event("mock_result", { ranked: true, globalPercentile: 70 }, 1),
    ])!;
    const ten = computeSignal(
      Array.from({ length: 10 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 70 }, 10 - i),
      ),
    )!;
    expect(ten.confidence).toBeGreaterThan(two.confidence);

    const diverse = computeSignal([
      ...Array.from({ length: 5 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 70 }, 10 - i),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        event("duel_result", { eloAfter: 1400 }, 5 - i),
      ),
    ])!;
    const monotone = computeSignal(
      Array.from({ length: 10 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 70 }, 10 - i),
      ),
    )!;
    expect(diverse.confidence).toBeGreaterThan(monotone.confidence);
    expect(diverse.confidence).toBeLessThanOrEqual(1);
  });

  it("detects improving and declining trajectories", () => {
    const improving = computeSignal([
      ...Array.from({ length: 6 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 40 }, 20 - i),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 85 }, 3 - i),
      ),
    ])!;
    expect(improving.trajectory).toBe("improving");

    const declining = computeSignal([
      ...Array.from({ length: 6 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 85 }, 20 - i),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        event("mock_result", { ranked: true, globalPercentile: 40 }, 3 - i),
      ),
    ])!;
    expect(declining.trajectory).toBe("declining");

    const few = computeSignal([
      event("mock_result", { ranked: true, globalPercentile: 40 }, 2),
      event("mock_result", { ranked: true, globalPercentile: 90 }, 1),
    ])!;
    expect(few.trajectory).toBe("stable");
  });
});

describe("verification tiers", () => {
  it("requires clean volume across two evidence kinds", () => {
    expect(
      verificationTier({ cleanEvents: 20, evidenceKinds: 2, upheldReviews: 0, pendingReviews: 0 }),
    ).toBe("verified");
    expect(
      verificationTier({ cleanEvents: 20, evidenceKinds: 1, upheldReviews: 0, pendingReviews: 0 }),
    ).toBe("standard");
    expect(
      verificationTier({ cleanEvents: 5, evidenceKinds: 3, upheldReviews: 0, pendingReviews: 0 }),
    ).toBe("standard");
  });

  it("any upheld or pending review drops to standard", () => {
    expect(
      verificationTier({ cleanEvents: 50, evidenceKinds: 3, upheldReviews: 1, pendingReviews: 0 }),
    ).toBe("standard");
    expect(
      verificationTier({ cleanEvents: 50, evidenceKinds: 3, upheldReviews: 0, pendingReviews: 2 }),
    ).toBe("standard");
  });
});

describe("calibration", () => {
  it("maps the 0-100 signal onto the 1-7 scale", () => {
    expect(signalToGrade(100)).toBe(7);
    expect(signalToGrade(50)).toBe(4);
    expect(signalToGrade(0)).toBe(1);
  });

  it("counts predictions within one grade", () => {
    const { withinOne, count } = calibrationAccuracy([
      { predicted_rating: 90, official_grade: 7 }, // grade 7 vs 7 ✓
      { predicted_rating: 50, official_grade: 5 }, // 4 vs 5 ✓
      { predicted_rating: 20, official_grade: 6 }, // 2 vs 6 ✗
    ]);
    expect(count).toBe(3);
    expect(withinOne).toBe(67);
    expect(calibrationAccuracy([])).toEqual({ withinOne: null, count: 0 });
  });
});
