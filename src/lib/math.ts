/**
 * Question text is prose with LaTeX islands. Authors delimit maths with
 * `$…$` / `\(…\)` (inline) or `$$…$$` / `\[…\]` (display); everything else is
 * plain text and is rendered untouched, so legacy questions written before
 * LaTeX support keep reading exactly as they did.
 */

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

export function looksLikeUnmarkedMath(text: string | null | undefined): boolean {
  if (!text) return false;
  const outsideMath = splitMath(text)
    .filter((s) => s.type === "text")
    .map((s) => s.value)
    .join(" ");
  return PLAIN_MATH_PATTERNS.some((re) => re.test(outsideMath));
}
