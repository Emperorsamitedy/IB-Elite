"use client";

import * as React from "react";
import katex from "katex";
import { splitMathAuto, type MathSegment } from "@/lib/math";
import { cn } from "@/lib/utils";

function render(segment: MathSegment): string | null {
  if (segment.type === "text") return null;
  // `throwOnError: false` makes KaTeX render the offending source in red
  // rather than blowing up the whole question on one bad formula.
  return katex.renderToString(segment.value, {
    displayMode: segment.type === "block",
    throwOnError: false,
    strict: false,
    trust: false,
    output: "html",
  });
}

/**
 * Question text with LaTeX islands rendered by KaTeX. Prose is preserved
 * verbatim, including line breaks, so non-maths subjects are unaffected.
 */
export function MathText({
  children,
  className,
  as: Tag = "div",
}: {
  children: string | null | undefined;
  className?: string;
  as?: "div" | "span" | "p";
}) {
  const segments = React.useMemo(() => splitMathAuto(children ?? ""), [children]);

  return (
    <Tag className={cn("whitespace-pre-wrap", className)}>
      {segments.map((segment, i) =>
        segment.type === "text" ? (
          <React.Fragment key={i}>{segment.value}</React.Fragment>
        ) : (
          <span
            key={i}
            className={segment.type === "block" ? "block my-2" : undefined}
            // KaTeX output is generated from the source above, not user HTML.
            dangerouslySetInnerHTML={{ __html: render(segment) ?? "" }}
          />
        ),
      )}
    </Tag>
  );
}
