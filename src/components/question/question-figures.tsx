"use client";

import * as React from "react";
import Image from "next/image";
import { GraphFigure } from "@/components/question/graph-figure";
import type { QuestionAssetView } from "@/lib/questions/assets";

/**
 * Diagrams, graphs and screenshots attached to a question. Fetched client-side
 * because the storage URLs are signed and short-lived.
 */
export function QuestionFigures({ questionId }: { questionId: string }) {
  const [assets, setAssets] = React.useState<QuestionAssetView[]>([]);

  React.useEffect(() => {
    let active = true;
    setAssets([]);
    void fetch(`/api/questions/${questionId}/assets`)
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((body: { assets: QuestionAssetView[] }) => {
        if (active) setAssets(body.assets ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [questionId]);

  if (assets.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {assets.map((asset) => (
        <figure key={asset.id} className="flex flex-col gap-1.5">
          {asset.kind === "graph" && asset.graph_spec ? (
            <GraphFigure spec={asset.graph_spec} className="max-w-lg" />
          ) : asset.url ? (
            <Image
              src={asset.url}
              alt={asset.alt_text ?? asset.caption ?? "Question figure"}
              width={640}
              height={420}
              unoptimized
              className="h-auto w-full max-w-lg rounded-lg border border-border bg-white"
            />
          ) : null}
          {asset.caption && (
            <figcaption className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {asset.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
