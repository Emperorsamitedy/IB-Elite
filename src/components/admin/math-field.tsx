"use client";

import * as React from "react";
import { Sigma, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MathText } from "@/components/ui/math-text";
import { hasMath, looksLikeUnmarkedMath } from "@/lib/math";
import { cn } from "@/lib/utils";

/**
 * A snippet inserted at the caret. `@` marks where the caret should land, so
 * an author can type straight into the numerator of a fraction.
 */
type Snippet = { label: string; latex: string; title: string };

const GROUPS: { name: string; snippets: Snippet[] }[] = [
  {
    name: "Algebra",
    snippets: [
      { label: "x²", latex: "@^{2}", title: "Power" },
      { label: "xₙ", latex: "@_{n}", title: "Subscript" },
      { label: "a/b", latex: "\\frac{@}{b}", title: "Fraction" },
      { label: "√", latex: "\\sqrt{@}", title: "Square root" },
      { label: "ⁿ√", latex: "\\sqrt[n]{@}", title: "nth root" },
      { label: "|x|", latex: "\\left|@\\right|", title: "Absolute value" },
      { label: "( )", latex: "\\left(@\\right)", title: "Sized brackets" },
      { label: "±", latex: "\\pm ", title: "Plus–minus" },
      { label: "×", latex: "\\times ", title: "Multiply" },
      { label: "≤", latex: "\\le ", title: "Less than or equal" },
      { label: "≥", latex: "\\ge ", title: "Greater than or equal" },
      { label: "≠", latex: "\\neq ", title: "Not equal" },
    ],
  },
  {
    name: "Calculus",
    snippets: [
      { label: "∫", latex: "\\int @\\,dx", title: "Integral" },
      { label: "∫ᵇₐ", latex: "\\int_{a}^{b} @\\,dx", title: "Definite integral" },
      { label: "d/dx", latex: "\\frac{d@}{dx}", title: "Derivative" },
      { label: "∂", latex: "\\frac{\\partial @}{\\partial x}", title: "Partial" },
      { label: "lim", latex: "\\lim_{x \\to @}", title: "Limit" },
      { label: "∑", latex: "\\sum_{n=1}^{@}", title: "Sum" },
      { label: "∞", latex: "\\infty ", title: "Infinity" },
    ],
  },
  {
    name: "Functions",
    snippets: [
      { label: "sin", latex: "\\sin(@)", title: "Sine" },
      { label: "cos", latex: "\\cos(@)", title: "Cosine" },
      { label: "tan", latex: "\\tan(@)", title: "Tangent" },
      { label: "ln", latex: "\\ln(@)", title: "Natural log" },
      { label: "log", latex: "\\log_{10}(@)", title: "Log base 10" },
      { label: "e^x", latex: "e^{@}", title: "Exponential" },
      { label: "π", latex: "\\pi ", title: "Pi" },
      { label: "θ", latex: "\\theta ", title: "Theta" },
      { label: "°", latex: "^{\\circ}", title: "Degrees" },
    ],
  },
  {
    name: "Vectors & matrices",
    snippets: [
      { label: "v⃗", latex: "\\vec{@}", title: "Vector" },
      { label: "( ᵃᵇ )", latex: "\\begin{pmatrix} @ \\\\ b \\end{pmatrix}", title: "Column vector" },
      {
        label: "2×2",
        latex: "\\begin{pmatrix} @ & b \\\\ c & d \\end{pmatrix}",
        title: "2×2 matrix",
      },
      { label: "cases", latex: "\\begin{cases} @ \\\\ b \\end{cases}", title: "Piecewise" },
    ],
  },
  {
    name: "Science",
    snippets: [
      { label: "→", latex: "\\rightarrow ", title: "Reaction arrow" },
      { label: "⇌", latex: "\\rightleftharpoons ", title: "Equilibrium" },
      { label: "H₂O", latex: "\\text{H}_2\\text{O}", title: "Chemical formula" },
      { label: "x⁺", latex: "^{+}", title: "Charge" },
      { label: "Δ", latex: "\\Delta ", title: "Delta" },
      { label: "units", latex: "\\,\\text{@}", title: "Upright units" },
    ],
  },
];

export function MathField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [group, setGroup] = React.useState(GROUPS[0].name);
  const snippets =
    GROUPS.find((g) => g.name === group)?.snippets ?? GROUPS[0].snippets;

  /** Replace the current selection, then place the caret at the snippet's `@`. */
  const applyAtCaret = (build: (selected: string) => string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const raw = build(selected);
    const caretOffset = raw.indexOf("@");
    const inserted = caretOffset === -1 ? raw : raw.replace("@", selected);
    const next = value.slice(0, start) + inserted + value.slice(end);

    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const caret =
        caretOffset === -1
          ? start + inserted.length
          : start + caretOffset + selected.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  // Snippets are only meaningful inside maths, so an unwrapped field gets
  // delimiters added along with the first symbol.
  const insert = (snippet: Snippet) =>
    applyAtCaret(() => (hasMath(value) ? snippet.latex : `$${snippet.latex}$`));

  const wrapSelection = () => applyAtCaret(() => "$@$");

  const needsAttention = looksLikeUnmarkedMath(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          LaTeX between $…$
        </span>
      </div>

      <div className="rounded-lg border border-input">
        <div className="flex flex-wrap items-center gap-1 border-b border-input bg-surface-2/50 p-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setGroup(g.name)}
              className={cn(
                "rounded-[4px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]",
                g.name === group
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {g.name}
            </button>
          ))}
          <span className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={wrapSelection}
              title="Wrap the selected text as maths"
            >
              <WrapText className="h-3.5 w-3.5" /> Wrap as maths
            </Button>
          </span>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-input p-1.5">
          {snippets.map((s) => (
            <button
              key={s.label + s.latex}
              type="button"
              title={`${s.title} — ${s.latex.replace("@", "…")}`}
              onClick={() => insert(s)}
              className="min-w-8 rounded-[4px] border border-border bg-background px-2 py-1 text-sm hover:border-accent hover:text-accent"
            >
              {s.label}
            </button>
          ))}
        </div>

        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        />

        <div className="border-t border-input bg-surface-2/30 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <Sigma className="h-3 w-3" /> Preview
          </p>
          {value.trim() ? (
            <MathText className="font-serif text-[15px] leading-relaxed">
              {value}
            </MathText>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      </div>

      {needsAttention && (
        <p className="font-mono text-[11px] text-accent">
          Looks like maths typed as plain text — wrap it in $…$ so it renders
          properly.
        </p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
