import { describe, expect, it } from "vitest";
import {
  hasMath,
  looksLikeUnmarkedMath,
  splitMath,
  splitMathAuto,
} from "@/lib/math";

const rendered = (text: string) =>
  splitMathAuto(text)
    .map((segment) => (segment.type === "text" ? segment.value : `[${segment.value}]`))
    .join("");

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

describe("splitMathAuto", () => {
  it("renders maths that was typed as plain text", () => {
    expect(
      rendered("Find the term independent of x in the expansion of (2x - 1/x^2)^9."),
    ).toBe(
      "Find the term independent of x in the expansion of [\\left(2x - \\frac{1}{x^{2}}\\right)^{9}].",
    );
  });

  it("leaves prose alone", () => {
    const prose = "Explain the role of the ribosome in translation.";
    expect(rendered(prose)).toBe(prose);
  });

  it("does not italicise chemical formulae or roman numerals as algebra", () => {
    expect(rendered("Water (H2O) boils at 100 degrees.")).toBe(
      "Water (H2O) boils at 100 degrees.",
    );
    expect(rendered("(i) State the trend.")).toBe("(i) State the trend.");
  });

  it("leaves date and mark ranges as written", () => {
    const text = "The 1919 - 1939 period is worth 8 - 10 marks.";
    expect(rendered(text)).toBe(text);
  });

  it("never re-parses maths the author already delimited", () => {
    expect(rendered("Solve $x^2 = 9$ for x.")).toBe("Solve [x^2 = 9] for x.");
  });

  it("finds the expression when prose is glued to its front", () => {
    expect(rendered("when [H+] = 1.0 x 10^-3")).toBe(
      "when [H+] = [1.0 \\times 10^{-3}]",
    );
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
