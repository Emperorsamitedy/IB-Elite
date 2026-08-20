import { describe, expect, it } from "vitest";
import { planAtLeast, planForPriceId } from "@/lib/plans";

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
