import { describe, expect, it } from "vitest";
import { asciiToLatex } from "./ascii-math";

describe("asciiToLatex", () => {
  it("turns division into a real fraction rather than a slash", () => {
    expect(asciiToLatex("1/x^2")).toBe("\\frac{1}{x^{2}}");
  });

  it("keeps a bracketed expression's own exponent outside the bracket", () => {
    expect(asciiToLatex("(2x - 1/x^2)^9")).toBe(
      "\\left(2x - \\frac{1}{x^{2}}\\right)^{9}",
    );
  });

  it("raises a trigonometric function rather than its argument", () => {
    expect(asciiToLatex("sin^2 theta")).toBe("\\sin^{2} \\theta");
  });

  it("reads sqrt as a radical", () => {
    expect(asciiToLatex("sqrt(2x + 1)")).toBe("\\sqrt{2x + 1}");
  });

  it("treats x between numbers as multiplication, not a variable", () => {
    expect(asciiToLatex("1.0 x 10^-3")).toBe("1.0 \\times 10^{-3}");
  });

  it("keeps implicit multiplication implicit", () => {
    expect(asciiToLatex("3(x+1)")).toBe("3\\left(x + 1\\right)");
  });

  it("maps comparisons and subscripts", () => {
    expect(asciiToLatex("x_1 <= 5")).toBe("x_{1} \\leq 5");
  });

  it("carries primes on derivatives", () => {
    expect(asciiToLatex("f'(x) = 2x")).toBe("f'\\left(x\\right) = 2x");
  });

  it("rejects prose so it is never mangled into symbols", () => {
    expect(asciiToLatex("the rate of reaction")).toBeNull();
  });

  it("rejects an unbalanced expression rather than guessing", () => {
    expect(asciiToLatex("(2x + 1")).toBeNull();
  });
});
