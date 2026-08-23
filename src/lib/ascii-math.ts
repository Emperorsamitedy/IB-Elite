/**
 * Converts maths written as plain text — `(2x - 1/x^2)^9`, `sqrt(2)`, `x_1` —
 * into LaTeX, so questions authored before LaTeX support render properly
 * instead of showing raw carets.
 *
 * This is a real (if tiny) recursive-descent parser rather than a pile of
 * regex substitutions, because `/` only becomes `\frac` once you know where
 * each operand starts and ends. Anything it cannot parse is rejected outright
 * and left as the author's text: a question that reads oddly is better than
 * one mangled into nonsense.
 */

type Token = {
  kind: "number" | "ident" | "op";
  value: string;
};

const OPERATORS = [
  "<=",
  ">=",
  "!=",
  "->",
  "+-",
  "^",
  "_",
  "/",
  "*",
  "+",
  "-",
  "=",
  "<",
  ">",
  "(",
  ")",
  "[",
  "]",
  ",",
  "'",
];

const GREEK = new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "theta",
  "lambda",
  "mu",
  "pi",
  "rho",
  "sigma",
  "phi",
  "omega",
]);

const FUNCTIONS = new Set([
  "sqrt",
  "sin",
  "cos",
  "tan",
  "arcsin",
  "arccos",
  "arctan",
  "log",
  "ln",
  "exp",
  "max",
  "min",
]);

/** A word that may appear inside an expression rather than ending it. */
export function isMathWord(word: string): boolean {
  const lower = word.toLowerCase();
  return word.length === 1 || GREEK.has(lower) || FUNCTIONS.has(lower);
}

export function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (/[0-9]/.test(char)) {
      const match = /^\d+(?:\.\d+)?/.exec(source.slice(i));
      if (!match) return null;
      tokens.push({ kind: "number", value: match[0] });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      const match = /^[A-Za-z]+/.exec(source.slice(i));
      if (!match || !isMathWord(match[0])) return null;
      tokens.push({ kind: "ident", value: match[0] });
      i += match[0].length;
      continue;
    }

    const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (!op) return null;
    tokens.push({ kind: "op", value: op });
    i += op.length;
  }

  return tokens.length > 0 ? tokens : null;
}

const RELATIONS: Record<string, string> = {
  "=": "=",
  "<": "<",
  ">": ">",
  "<=": "\\leq ",
  ">=": "\\geq ",
  "!=": "\\neq ",
  "->": "\\to ",
};

class Parser {
  private at = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): string {
    const value = this.relation();
    if (this.at < this.tokens.length) throw new Error("trailing input");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.at];
  }

  private eat(value: string): boolean {
    if (this.peek()?.value === value) {
      this.at += 1;
      return true;
    }
    return false;
  }

  private relation(): string {
    let left = this.sum();
    for (;;) {
      const token = this.peek();
      const relation = token && token.kind === "op" ? RELATIONS[token.value] : undefined;
      if (!relation) return left;
      this.at += 1;
      left = `${left} ${relation} ${this.sum()}`;
    }
  }

  private sum(): string {
    let left = this.eat("-") ? `-${this.product()}` : this.product();
    for (;;) {
      if (this.eat("+-")) left = `${left} \\pm ${this.product()}`;
      else if (this.eat("+")) left = `${left} + ${this.product()}`;
      else if (this.eat("-")) left = `${left} - ${this.product()}`;
      else return left;
    }
  }

  private product(): string {
    let left = this.power();
    for (;;) {
      if (this.eat("/")) {
        left = `\\frac{${left}}{${this.power()}}`;
      } else if (this.eat("*")) {
        left = `${left} \\times ${this.power()}`;
      } else if (this.isTimesLetter()) {
        // Scientific notation is written `1.0 x 10^-3`, where x is an operator.
        this.at += 1;
        left = `${left} \\times ${this.power()}`;
      } else if (this.startsFactor()) {
        // Implicit multiplication: 2x, 3(x+1).
        left = `${left}${this.power()}`;
      } else {
        return left;
      }
    }
  }

  private isTimesLetter(): boolean {
    const token = this.peek();
    const next = this.tokens[this.at + 1];
    return (
      token?.kind === "ident" &&
      token.value === "x" &&
      next?.kind === "number" &&
      this.tokens[this.at - 1]?.kind === "number"
    );
  }

  private startsFactor(): boolean {
    const token = this.peek();
    if (!token) return false;
    if (token.kind !== "op") return true;
    return token.value === "(" || token.value === "[";
  }

  private power(): string {
    let base = this.atom();
    while (this.eat("'")) base = `${base}'`;
    if (this.eat("^")) return `${base}^{${this.power()}}`;
    if (this.eat("_")) return `${base}_{${this.power()}}`;
    return base;
  }

  private atom(): string {
    if (this.eat("-")) return `-${this.atom()}`;

    const token = this.peek();
    if (!token) throw new Error("unexpected end");

    if (token.kind === "number") {
      this.at += 1;
      return token.value;
    }

    if (token.kind === "ident") {
      this.at += 1;
      const lower = token.value.toLowerCase();
      if (GREEK.has(lower)) return `\\${lower} `;
      if (FUNCTIONS.has(lower)) return this.call(lower);
      return token.value;
    }

    if (token.value === "(" || token.value === "[") {
      this.at += 1;
      const close = token.value === "(" ? ")" : "]";
      const inner = this.list();
      if (!this.eat(close)) throw new Error("unbalanced bracket");
      const [open] = token.value === "(" ? ["(", ")"] : ["[", "]"];
      return `\\left${open}${inner}\\right${close}`;
    }

    throw new Error(`unexpected ${token.value}`);
  }

  /** Arguments and bracketed groups may be comma-separated. */
  private list(): string {
    let value = this.relation();
    while (this.eat(",")) value = `${value}, ${this.relation()}`;
    return value;
  }

  private call(name: string): string {
    // `sin^2 x` raises the function, not its argument.
    const exponent = this.eat("^") ? this.atom() : null;
    const applied = (argument: string) =>
      name === "sqrt"
        ? `\\sqrt{${argument}}`
        : `\\${name}${exponent ? `^{${exponent}}` : ""}${argument}`;

    const bracketed = this.peek()?.value === "(";
    if (!bracketed) {
      // `sqrt2`, `sin x` — the operand is whatever follows.
      return applied(name === "sqrt" ? this.power() : ` ${this.power()}`);
    }

    this.at += 1;
    const inner = this.list();
    if (!this.eat(")")) throw new Error("unbalanced call");
    return applied(name === "sqrt" ? inner : `\\left(${inner}\\right)`);
  }
}

/**
 * LaTeX for a plain-text expression, or null when it does not parse cleanly.
 */
export function asciiToLatex(source: string): string | null {
  const tokens = tokenize(source);
  if (!tokens) return null;
  try {
    return new Parser(tokens).parse().replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}
