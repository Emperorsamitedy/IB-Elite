/**
 * Function graphs for question figures. Expressions are authored by admins but
 * still never evaluated with `eval`: they are tokenised and compiled by a small
 * shunting-yard parser that only knows numbers, `x`, and the whitelist below.
 */

export type GraphFunction = { expression: string; color: string };

export type GraphSpec = {
  functions: GraphFunction[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel?: string;
  yLabel?: string;
  showGrid: boolean;
};

export const DEFAULT_GRAPH_SPEC: GraphSpec = {
  functions: [{ expression: "x^2", color: "#E5372A" }],
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  showGrid: true,
};

const FUNCTIONS: Record<string, (n: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { kind: "number"; value: number }
  | { kind: "variable" }
  | { kind: "function"; name: string }
  | { kind: "operator"; value: string }
  | { kind: "paren"; value: "(" | ")" };

const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
  // Unary minus binds tighter than `*` but looser than `^`, so `-2^2` is -4.
  u: 2.5,
};

export class ExpressionError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.replace(/\s+/g, "");

  while (i < src.length) {
    const char = src[i];

    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!match) throw new ExpressionError(`Bad number at position ${i}`);
      tokens.push({ kind: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }

    if (/[a-z]/i.test(char)) {
      const name = /^[a-z]+/i.exec(src.slice(i))![0].toLowerCase();
      i += name.length;
      if (name === "x") tokens.push({ kind: "variable" });
      else if (name in CONSTANTS)
        tokens.push({ kind: "number", value: CONSTANTS[name] });
      else if (name in FUNCTIONS) tokens.push({ kind: "function", name });
      else throw new ExpressionError(`Unknown name "${name}"`);
      continue;
    }

    if ("+-*/^".includes(char)) {
      const previous = tokens[tokens.length - 1];
      const isUnary =
        char === "-" &&
        (!previous ||
          previous.kind === "operator" ||
          (previous.kind === "paren" && previous.value === "("));
      tokens.push({ kind: "operator", value: isUnary ? "u" : char });
      i += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
      i += 1;
      continue;
    }

    throw new ExpressionError(`Unexpected character "${char}"`);
  }

  return tokens;
}

/** Shunting-yard: infix tokens to reverse Polish. */
function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.kind === "number" || token.kind === "variable") {
      output.push(token);
    } else if (token.kind === "function") {
      stack.push(token);
    } else if (token.kind === "operator") {
      // Prefix minus is right-associative: it never pops what precedes it.
      if (token.value === "u") {
        stack.push(token);
        continue;
      }
      while (stack.length) {
        const top = stack[stack.length - 1];
        const higher =
          (top.kind === "operator" &&
            (PRECEDENCE[top.value] > PRECEDENCE[token.value] ||
              (PRECEDENCE[top.value] === PRECEDENCE[token.value] &&
                token.value !== "^" &&
                token.value !== "u"))) ||
          top.kind === "function";
        if (!higher) break;
        output.push(stack.pop()!);
      }
      stack.push(token);
    } else if (token.value === "(") {
      stack.push(token);
    } else {
      let matched = false;
      while (stack.length) {
        const top = stack.pop()!;
        if (top.kind === "paren" && top.value === "(") {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) throw new ExpressionError("Unbalanced brackets");
    }
  }

  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === "paren") throw new ExpressionError("Unbalanced brackets");
    output.push(top);
  }

  return output;
}

/**
 * Compile `f(x)`. Throws `ExpressionError` for anything malformed, so the admin
 * form can report it before the asset is saved.
 */
export function compileExpression(expression: string): (x: number) => number {
  const rpn = toRpn(tokenize(expression));
  if (!rpn.length) throw new ExpressionError("Empty expression");

  return (x: number) => {
    const stack: number[] = [];
    for (const token of rpn) {
      if (token.kind === "number") stack.push(token.value);
      else if (token.kind === "variable") stack.push(x);
      else if (token.kind === "function") {
        const a = stack.pop();
        if (a === undefined) throw new ExpressionError("Missing argument");
        stack.push(FUNCTIONS[token.name](a));
      } else if (token.kind === "operator") {
        if (token.value === "u") {
          const a = stack.pop();
          if (a === undefined) throw new ExpressionError("Missing operand");
          stack.push(-a);
          continue;
        }
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined)
          throw new ExpressionError("Missing operand");
        stack.push(
          token.value === "+"
            ? a + b
            : token.value === "-"
              ? a - b
              : token.value === "*"
                ? a * b
                : token.value === "/"
                  ? a / b
                  : Math.pow(a, b),
        );
      }
    }
    if (stack.length !== 1) throw new ExpressionError("Malformed expression");
    return stack[0];
  };
}

export type PlotPoint = { x: number; y: number };

/**
 * Sample a function across the spec's x range, in SVG user units. Undefined and
 * off-range samples break the path into separate segments, so an asymptote is a
 * gap rather than a vertical line through the plot.
 */
export function samplePath(
  spec: GraphSpec,
  expression: string,
  width: number,
  height: number,
  samples = 400,
): PlotPoint[][] {
  const f = compileExpression(expression);
  const toSvgX = (x: number) =>
    ((x - spec.xMin) / (spec.xMax - spec.xMin)) * width;
  const toSvgY = (y: number) =>
    height - ((y - spec.yMin) / (spec.yMax - spec.yMin)) * height;

  const segments: PlotPoint[][] = [];
  let current: PlotPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = spec.xMin + ((spec.xMax - spec.xMin) * i) / samples;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = Number.NaN;
    }

    const visible =
      Number.isFinite(y) && y >= spec.yMin - 1e-9 && y <= spec.yMax + 1e-9;
    if (visible) {
      current.push({ x: toSvgX(x), y: toSvgY(y) });
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export function toSvgPath(points: PlotPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/** Gridline positions in graph units, at a readable step for the range. */
export function gridLines(min: number, max: number): number[] {
  const span = Math.abs(max - min);
  if (span <= 0) return [];
  const rawStep = span / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)!;
  const lines: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    lines.push(Number(v.toFixed(10)));
  }
  return lines;
}
