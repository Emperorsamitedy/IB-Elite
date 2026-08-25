import { describe, expect, it } from "vitest";
import { planAtLeast, planForPriceId, resolvePlan } from "@/lib/plans";

const PRICES = {
  proMonthly: "price_pro_m",
  proAnnual: "price_pro_y",
  maxMonthly: "price_max_m",
};

describe("planForPriceId", () => {
  it("maps the Max price to the Max tier", () => {
    expect(planForPriceId("price_max_m", PRICES)).toBe("max");
  });

  it("maps either Pro price to the Pro tier", () => {
    expect(planForPriceId("price_pro_m", PRICES)).toBe("pro");
    expect(planForPriceId("price_pro_y", PRICES)).toBe("pro");
  });

  // A subscriber must never lose access because the price IDs moved on.
  it("keeps an unknown or missing price on Pro rather than downgrading", () => {
    expect(planForPriceId("price_retired", PRICES)).toBe("pro");
    expect(planForPriceId(null, PRICES)).toBe("pro");
  });

  it("does not grant Max when no Max price is configured", () => {
    expect(planForPriceId("", { ...PRICES, maxMonthly: "" })).toBe("pro");
  });
});

describe("planAtLeast", () => {
  it("treats Max as covering everything Pro unlocks", () => {
    expect(planAtLeast("max", "pro")).toBe(true);
    expect(planAtLeast("pro", "max")).toBe(false);
    expect(planAtLeast("free", "pro")).toBe(false);
    expect(planAtLeast("pro", "pro")).toBe(true);
  });
});

describe("resolvePlan", () => {
  // The tier stamped at checkout must win: price IDs rotate, metadata doesn't.
  it("prefers the plan recorded on the subscription row", () => {
    expect(resolvePlan("max", "price_pro_m", PRICES)).toBe("max");
    expect(resolvePlan("pro", "price_max_m", PRICES)).toBe("pro");
  });

  it("keeps a Max subscriber on Max even when the Max price is unset", () => {
    expect(resolvePlan("max", "price_max_m", { ...PRICES, maxMonthly: "" })).toBe(
      "max",
    );
  });

  it("falls back to the price lookup for rows without a recorded plan", () => {
    expect(resolvePlan(null, "price_max_m", PRICES)).toBe("max");
    expect(resolvePlan(undefined, "price_pro_y", PRICES)).toBe("pro");
    expect(resolvePlan("free", "price_max_m", PRICES)).toBe("max");
    expect(resolvePlan("garbage", "price_pro_m", PRICES)).toBe("pro");
  });
});
