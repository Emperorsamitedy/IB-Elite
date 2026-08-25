import { describe, expect, it } from "vitest";
import { normalizeCity } from "./city";

describe("normalizeCity", () => {
  it("collapses whitespace and title-cases", () => {
    expect(normalizeCity("  addis   ababa ")).toBe("Addis Ababa");
    expect(normalizeCity("ADDIS ABABA")).toBe("Addis Ababa");
    expect(normalizeCity("london")).toBe("London");
  });

  it("empty and missing values become null", () => {
    expect(normalizeCity("")).toBeNull();
    expect(normalizeCity("   ")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity(undefined)).toBeNull();
  });
});
