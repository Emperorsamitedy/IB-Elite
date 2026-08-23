"use client";

import * as React from "react";
import {
  ExpressionError,
  gridLines,
  samplePath,
  toSvgPath,
  type GraphSpec,
} from "@/lib/graph";
import { cn } from "@/lib/utils";

const WIDTH = 480;
const HEIGHT = 320;

/** A graph drawn from its spec — no image file, so it stays crisp at any size. */
export function GraphFigure({
  spec,
  className,
}: {
  spec: GraphSpec;
  className?: string;
}) {
  const { curves, errors } = React.useMemo(() => {
    const curves: { path: string; color: string }[] = [];
    const errors: string[] = [];
    for (const fn of spec.functions) {
      try {
        for (const segment of samplePath(spec, fn.expression, WIDTH, HEIGHT)) {
          curves.push({ path: toSvgPath(segment), color: fn.color });
        }
      } catch (error) {
        errors.push(
          `${fn.expression}: ${
            error instanceof ExpressionError ? error.message : "invalid"
          }`,
        );
      }
    }
    return { curves, errors };
  }, [spec]);

  const toX = (x: number) =>
    ((x - spec.xMin) / (spec.xMax - spec.xMin)) * WIDTH;
  const toY = (y: number) =>
    HEIGHT - ((y - spec.yMin) / (spec.yMax - spec.yMin)) * HEIGHT;

  const xLines = gridLines(spec.xMin, spec.xMax);
  const yLines = gridLines(spec.yMin, spec.yMax);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded-lg border border-border bg-surface"
        role="img"
        aria-label={spec.functions.map((f) => `y = ${f.expression}`).join(", ")}
      >
        {spec.showGrid && (
          <g stroke="currentColor" className="text-border" strokeWidth={0.5}>
            {xLines.map((v) => (
              <line key={`x${v}`} x1={toX(v)} y1={0} x2={toX(v)} y2={HEIGHT} />
            ))}
            {yLines.map((v) => (
              <line key={`y${v}`} x1={0} y1={toY(v)} x2={WIDTH} y2={toY(v)} />
            ))}
          </g>
        )}

        {/* Axes, drawn only where zero is inside the visible range. */}
        <g stroke="currentColor" className="text-foreground" strokeWidth={1.2}>
          {spec.yMin <= 0 && spec.yMax >= 0 && (
            <line x1={0} y1={toY(0)} x2={WIDTH} y2={toY(0)} />
          )}
          {spec.xMin <= 0 && spec.xMax >= 0 && (
            <line x1={toX(0)} y1={0} x2={toX(0)} y2={HEIGHT} />
          )}
        </g>

        <g className="fill-muted-foreground font-mono" fontSize={9}>
          {xLines
            .filter((v) => v !== 0)
            .map((v) => (
              <text key={`xl${v}`} x={toX(v)} y={Math.min(HEIGHT - 2, toY(0) + 10)} textAnchor="middle">
                {v}
              </text>
            ))}
          {yLines
            .filter((v) => v !== 0)
            .map((v) => (
              <text key={`yl${v}`} x={Math.max(2, toX(0) + 4)} y={toY(v) - 2}>
                {v}
              </text>
            ))}
        </g>

        {curves.map((curve, i) => (
          <path
            key={i}
            d={curve.path}
            fill="none"
            stroke={curve.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}

        {(spec.xLabel || spec.yLabel) && (
          <g className="fill-muted-foreground font-mono" fontSize={11}>
            {spec.xLabel && (
              <text x={WIDTH - 4} y={HEIGHT - 6} textAnchor="end">
                {spec.xLabel}
              </text>
            )}
            {spec.yLabel && (
              <text x={6} y={14}>
                {spec.yLabel}
              </text>
            )}
          </g>
        )}
      </svg>

      {errors.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-accent">
          {errors.join(" · ")}
        </p>
      )}
    </div>
  );
}
