import { describe, expect, it } from "vitest";
import { hasMath, looksLikeUnmarkedMath, splitMath } from "@/lib/math";

describe("splitMath", () => {
  it("keeps text with no maths as a single plain segment", () => {
    expect(splitMath("Explain the process.")).toEqual([
      { type: "text", value: "Explain the process." },
    ]);
  });

  it("splits inline maths out of surrounding prose", () => {
    expect(splitMath("Solve $4^x = 16$ for x.")).toEqual([
      { type: "text", value: "Solve " },
      { type: "inline", value: "4^x = 16" },
      { type: "text", value: " for x." },
    ]);
  });

  it("prefers $$ over $ so display maths is not split into two inlines", () => {
    expect(splitMath("$$\\int_0^1 x\\,dx$$")).toEqual([
      { type: "block", value: "\\int_0^1 x\\,dx" },
    ]);
  });

  it("supports \\( \\) and \\[ \\] delimiters", () => {
    expect(splitMath("\\(a+b\\) and \\[c\\]")).toEqual([
      { type: "inline", value: "a+b" },
      { type: "text", value: " and " },
      { type: "block", value: "c" },
    ]);
  });

  // A stray dollar sign in a price or a typo must not eat the question.
  it("treats an unterminated delimiter as literal text", () => {
    expect(splitMath("Costs $5 to produce")).toEqual([
      { type: "text", value: "Costs $5 to produce" },
    ]);
  });

  it("treats an escaped dollar as literal", () => {
    expect(splitMath("Revenue of \\$40m")).toEqual([
      { type: "text", value: "Revenue of \\$40m" },
    ]);
  });

  it("does not emit an empty maths segment", () => {
    expect(splitMath("a $$ b")).toEqual([{ type: "text", value: "a $$ b" }]);
  });

  it("reports whether any maths is present", () => {
    expect(hasMath("plain")).toBe(false);
    expect(hasMath("$x$")).toBe(true);
  });
});

describe("looksLikeUnmarkedMath", () => {
  it("flags maths typed as plain text", () => {
    expect(looksLikeUnmarkedMath("Solve 4^x = 16")).toBe(true);
    expect(looksLikeUnmarkedMath("Find sqrt(2)")).toBe(true);
    expect(looksLikeUnmarkedMath("State x_1")).toBe(true);
  });

  it("does not flag text whose maths is already delimited", () => {
    expect(looksLikeUnmarkedMath("Solve $4^x = 16$")).toBe(false);
  });

  it("does not flag ordinary prose", () => {
    expect(looksLikeUnmarkedMath("Describe the role of the ribosome.")).toBe(
      false,
    );
    expect(looksLikeUnmarkedMath(null)).toBe(false);
  });
});
