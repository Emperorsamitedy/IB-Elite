import { describe, expect, it } from "vitest";
import {
  compileExpression,
  ExpressionError,
  gridLines,
  samplePath,
  DEFAULT_GRAPH_SPEC,
} from "@/lib/graph";

describe("compileExpression", () => {
  it("evaluates arithmetic with correct precedence", () => {
    expect(compileExpression("2 + 3 * 4")(0)).toBe(14);
    expect(compileExpression("(2 + 3) * 4")(0)).toBe(20);
  });

  it("treats ^ as right-associative", () => {
    expect(compileExpression("2^3^2")(0)).toBe(512);
  });

  it("substitutes x", () => {
    const f = compileExpression("x^2 - 4");
    expect(f(3)).toBe(5);
    expect(f(-2)).toBe(0);
  });

  it("handles unary minus, including before a bracket", () => {
    expect(compileExpression("-x")(4)).toBe(-4);
    expect(compileExpression("-(3 - 5)")(0)).toBe(2);
    expect(compileExpression("-2^2")(0)).toBe(-4);
  });

  it("supports the whitelisted functions and constants", () => {
    expect(compileExpression("sin(0)")(0)).toBe(0);
    expect(compileExpression("ln(e)")(0)).toBeCloseTo(1);
    expect(compileExpression("cos(pi)")(0)).toBeCloseTo(-1);
  });

  // The whole point of hand-rolling the parser: nothing outside the whitelist runs.
  it("rejects anything that is not a number, x or a known function", () => {
    expect(() => compileExpression("alert(1)")).toThrow(ExpressionError);
    expect(() => compileExpression("window")).toThrow(ExpressionError);
    expect(() => compileExpression("x @ 2")).toThrow(ExpressionError);
    expect(() => compileExpression("(x + 1")).toThrow(ExpressionError);
    expect(() => compileExpression("")).toThrow(ExpressionError);
  });
});

describe("samplePath", () => {
  it("maps the graph range onto SVG coordinates, y flipped", () => {
    const spec = { ...DEFAULT_GRAPH_SPEC, functions: [], xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
    const [segment] = samplePath(spec, "x", 100, 100, 2);

    expect(segment[0]).toEqual({ x: 0, y: 100 }); // (-1,-1) is bottom-left
    expect(segment[1]).toEqual({ x: 50, y: 50 });
    expect(segment[2]).toEqual({ x: 100, y: 0 }); // (1,1) is top-right
  });

  // An asymptote must break the line, not draw a vertical stroke across the plot.
  it("splits the path where the function leaves the visible range", () => {
    const spec = { ...DEFAULT_GRAPH_SPEC, functions: [], xMin: -2, xMax: 2, yMin: -5, yMax: 5 };
    const segments = samplePath(spec, "1/x", 100, 100, 100);

    expect(segments.length).toBeGreaterThan(1);
  });
});

describe("gridLines", () => {
  it("picks a round step covering the range", () => {
    expect(gridLines(-5, 5)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
    expect(gridLines(0, 100)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });
});
