"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraphFigure } from "@/components/question/graph-figure";
import { compileExpression, DEFAULT_GRAPH_SPEC, type GraphSpec } from "@/lib/graph";

const PALETTE = ["#E5372A", "#2563EB", "#16A34A", "#9333EA"];

/** Spec editor with a live plot; the same renderer students see. */
export function GraphBuilder({
  spec,
  onChange,
}: {
  spec: GraphSpec;
  onChange: (spec: GraphSpec) => void;
}) {
  const errors = spec.functions.map((fn) => {
    try {
      compileExpression(fn.expression);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid";
    }
  });

  const setNumber = (key: keyof GraphSpec, value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onChange({ ...spec, [key]: parsed });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {spec.functions.map((fn, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">y =</span>
              <Input
                value={fn.expression}
                placeholder="x^2 - 3*x + 1"
                onChange={(e) => {
                  const functions = [...spec.functions];
                  functions[i] = { ...fn, expression: e.target.value };
                  onChange({ ...spec, functions });
                }}
              />
              <input
                type="color"
                aria-label="Curve colour"
                value={fn.color}
                className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent"
                onChange={(e) => {
                  const functions = [...spec.functions];
                  functions[i] = { ...fn, color: e.target.value };
                  onChange({ ...spec, functions });
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove curve"
                disabled={spec.functions.length === 1}
                onClick={() =>
                  onChange({
                    ...spec,
                    functions: spec.functions.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {errors[i] && (
              <p className="font-mono text-[11px] text-accent">{errors[i]}</p>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={spec.functions.length >= 4}
          onClick={() =>
            onChange({
              ...spec,
              functions: [
                ...spec.functions,
                {
                  expression: "x",
                  color: PALETTE[spec.functions.length % PALETTE.length],
                },
              ],
            })
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add curve
        </Button>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["xMin", "xMax", "yMin", "yMax"] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label>{key}</Label>
              <Input
                type="number"
                value={spec[key]}
                onChange={(e) => setNumber(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>x-axis label</Label>
            <Input
              value={spec.xLabel ?? ""}
              onChange={(e) =>
                onChange({ ...spec, xLabel: e.target.value || undefined })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>y-axis label</Label>
            <Input
              value={spec.yLabel ?? ""}
              onChange={(e) =>
                onChange({ ...spec, yLabel: e.target.value || undefined })
              }
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={spec.showGrid}
            onChange={(e) => onChange({ ...spec, showGrid: e.target.checked })}
          />
          Gridlines
        </label>

        <p className="font-mono text-[11px] text-muted-foreground">
          Allowed: numbers, x, + − × ÷ ^, brackets, pi, e, sin, cos, tan, asin,
          acos, atan, sinh, cosh, tanh, ln, log, sqrt, abs, exp, floor, ceil.
        </p>
      </div>

      <GraphFigure spec={spec} />
    </div>
  );
}

export { DEFAULT_GRAPH_SPEC };
