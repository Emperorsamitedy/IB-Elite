/**
 * Question text is prose with LaTeX islands. Authors delimit maths with
 * `$…$` / `\(…\)` (inline) or `$$…$$` / `\[…\]` (display); everything else is
 * plain text and is rendered untouched, so legacy questions written before
 * LaTeX support keep reading exactly as they did.
 */

import { asciiToLatex, isMathWord } from "./ascii-math";

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

type Delimiter = {
  open: string;
  close: string;
  type: "inline" | "block";
};

// Longest openers first: `$$` must win over `$`.
const DELIMITERS: Delimiter[] = [
  { open: "$$", close: "$$", type: "block" },
  { open: "\\[", close: "\\]", type: "block" },
  { open: "\\(", close: "\\)", type: "inline" },
  { open: "$", close: "$", type: "inline" },
];

function delimiterAt(text: string, index: number): Delimiter | null {
  // A backslash-escaped delimiter is literal text, not maths.
  if (index > 0 && text[index - 1] === "\\" && text[index] === "$") return null;
  return DELIMITERS.find((d) => text.startsWith(d.open, index)) ?? null;
}

/**
 * Split text into plain and maths segments. An unterminated opener is treated
 * as literal text rather than swallowing the rest of the question.
 */
export function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let plain = "";
  let i = 0;

  const flush = () => {
    if (plain) segments.push({ type: "text", value: plain });
    plain = "";
  };

  while (i < text.length) {
    const delim = delimiterAt(text, i);
    if (!delim) {
      plain += text[i];
      i += 1;
      continue;
    }

    const contentStart = i + delim.open.length;
    const end = text.indexOf(delim.close, contentStart);
    if (end === -1) {
      plain += text[i];
      i += 1;
      continue;
    }

    const value = text.slice(contentStart, end).trim();
    if (value) {
      flush();
      segments.push({ type: delim.type, value });
    } else {
      plain += text.slice(i, end + delim.close.length);
    }
    i = end + delim.close.length;
  }

  flush();
  return segments;
}

/** Whether text contains any delimited maths at all. */
export function hasMath(text: string): boolean {
  return splitMath(text).some((s) => s.type !== "text");
}

/**
 * Maths written as plain text — `4^x`, `sqrt(2)`, `x_1`, `->`. Used to flag
 * legacy rows in the admin bank for conversion; deliberately advisory, since
 * rewriting them automatically would mangle prose.
 */
const PLAIN_MATH_PATTERNS = [
  /[A-Za-z0-9)\]]\^[A-Za-z0-9({]/, // 4^x, x^2
  /\bsqrt\s*\(/i,
  /[A-Za-z]_\d/, // x_1
  /(^|\s)[-=]>(\s|$)/, // -> reaction/limit arrows
  /\d\s*\/\s*\d/, // 3/4 as a fraction
  /[≤≥≠±∫∑√π]/,
];

/** Characters that can appear in an undelimited expression. */
const EXPRESSION_CHARS = /[0-9+\-*/^_=<>(),[\]!.']/;

/**
 * Enough structure to be maths rather than prose that happens to contain a
 * dash or a bracket. Implicit multiplication alone is deliberately not a
 * signal: `(H2O)` and `(i)` would otherwise be italicised as algebra.
 */
const MATH_SIGNALS = [
  /[\^_]/,
  /[A-Za-z0-9)\]]\s*\/\s*[A-Za-z0-9(]/,
  /\b(sqrt|sin|cos|tan|log|ln|exp|pi|theta|alpha|beta|lambda|sigma|omega)\b/i,
  /[<>=]/,
  /[A-Za-z)]\s*\*\s*[A-Za-z0-9(]/,
];

function isExpressionToken(token: string): boolean {
  if (/^\s+$/.test(token)) return true;
  if (/^[A-Za-z]+$/.test(token)) return isMathWord(token);
  return [...token].every((char) => EXPRESSION_CHARS.test(char));
}

/** Operators dangling at either end belong to the prose, not the expression. */
function trimToExpression(run: string): string {
  return run
    .replace(/^[\s+\-*/^_=<>,.!]+/, "")
    .replace(/[\s+\-*/^_=<>,.!]+$/, "");
}

/**
 * The longest parseable expression at the end of a run. Prose often glues a
 * word-like fragment to the front (`[H+] = 1.0 x 10^-3`), so when the whole
 * run fails to parse the leading words are dropped one at a time.
 */
function longestExpression(
  run: string,
): { start: number; end: number; latex: string } | null {
  let offset = 0;

  while (offset < run.length) {
    const rest = run.slice(offset);
    const candidate = trimToExpression(rest);
    if (!candidate) return null;

    const start = offset + rest.indexOf(candidate);
    if (MATH_SIGNALS.some((signal) => signal.test(candidate))) {
      const latex = asciiToLatex(candidate);
      if (latex) return { start, end: start + candidate.length, latex };
    }

    const nextGap = run.slice(start).search(/\s/);
    if (nextGap === -1) return null;
    offset = start + nextGap + 1;
  }

  return null;
}

/**
 * Find undelimited maths in prose and render it as LaTeX. Legacy questions were
 * written as `(2x - 1/x^2)^9`, and there are far too many to hand-edit, so they
 * are converted at read time. A run is only converted when it parses cleanly
 * *and* looks structurally like maths — otherwise the author's text stands.
 */
export function autoMathSegments(text: string): MathSegment[] {
  const tokens = text.match(/[A-Za-z]+|\d+(?:\.\d+)?|\s+|[^A-Za-z0-9\s]/g);
  if (!tokens) return text ? [{ type: "text", value: text }] : [];

  const segments: MathSegment[] = [];
  let plain = "";
  let run = "";

  const pushPlain = (value: string) => {
    if (value) plain += value;
  };

  const flushRun = () => {
    if (!run) return;
    const found = longestExpression(run);

    if (!found) {
      pushPlain(run);
      run = "";
      return;
    }

    pushPlain(run.slice(0, found.start));
    if (plain) segments.push({ type: "text", value: plain });
    plain = "";
    segments.push({ type: "inline", value: found.latex });
    pushPlain(run.slice(found.end));
    run = "";
  };

  for (const token of tokens) {
    if (isExpressionToken(token)) {
      // Leading whitespace only counts once an expression is under way.
      if (!run && /^\s+$/.test(token)) pushPlain(token);
      else run += token;
    } else {
      flushRun();
      pushPlain(token);
    }
  }
  flushRun();
  if (plain) segments.push({ type: "text", value: plain });

  return segments;
}

/**
 * Segments for rendering: authored LaTeX first, then plain runs that look like
 * maths. Author-delimited maths is never re-parsed.
 */
export function splitMathAuto(text: string): MathSegment[] {
  return splitMath(text).flatMap((segment) =>
    segment.type === "text" ? autoMathSegments(segment.value) : [segment],
  );
}

export function looksLikeUnmarkedMath(text: string | null | undefined): boolean {
  if (!text) return false;
  const outsideMath = splitMath(text)
    .filter((s) => s.type === "text")
    .map((s) => s.value)
    .join(" ");
  return PLAIN_MATH_PATTERNS.some((re) => re.test(outsideMath));
}
