"use client";

import * as React from "react";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";
import type { CriterionAward } from "@/lib/mock/types";

export type ScriptPage = { pageIndex: number; url: string };

/**
 * The annotated script: each page image with criterion marks overlaid where
 * the examiner found (or missed) the evidence. Boxes come in original-image
 * pixels, so overlays are placed as percentages of the natural size —
 * the same trick the practice scan marker uses.
 */
export function MockScriptViewer({
  pages,
  awards,
}: {
  pages: ScriptPage[];
  awards: CriterionAward[];
}) {
  if (pages.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">{messages.mock.annotatedScript}</h3>
      {pages.map((page) => (
        <ScriptPageView
          key={page.pageIndex}
          page={page}
          awards={awards.filter((a) => a.pageIndex === page.pageIndex && a.box)}
        />
      ))}
    </div>
  );
}

function ScriptPageView({
  page,
  awards,
}: {
  page: ScriptPage;
  awards: CriterionAward[];
}) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, unknown dimensions */}
      <img
        src={page.url}
        alt={`Script page ${page.pageIndex + 1}`}
        className="w-full"
        onLoad={(event) =>
          setSize({
            w: event.currentTarget.naturalWidth,
            h: event.currentTarget.naturalHeight,
          })
        }
      />
      {size &&
        awards.map((award) => {
          const full = award.awarded >= award.maxMarks;
          const none = award.awarded === 0;
          return (
            <span
              key={award.criterionId}
              title={`${award.title}: ${award.awarded}/${award.maxMarks}${award.comment ? ` — ${award.comment}` : ""}`}
              className={cn(
                "pointer-events-auto absolute rounded-sm border-2",
                full
                  ? "border-success"
                  : none
                    ? "border-danger"
                    : "border-highlight",
              )}
              style={{
                left: `${(award.box!.x / size.w) * 100}%`,
                top: `${(award.box!.y / size.h) * 100}%`,
                width: `${Math.max((award.box!.width / size.w) * 100, 4)}%`,
                height: `${Math.max((award.box!.height / size.h) * 100, 1.5)}%`,
              }}
            >
              <span
                className={cn(
                  "absolute -top-5 left-0 whitespace-nowrap rounded px-1 font-mono text-[10px] font-bold text-background",
                  full ? "bg-success" : none ? "bg-danger" : "bg-highlight",
                )}
              >
                {award.awarded}/{award.maxMarks}
              </span>
            </span>
          );
        })}
    </div>
  );
}
