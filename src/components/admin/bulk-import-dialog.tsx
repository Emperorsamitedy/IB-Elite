"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseCsv, type ImportResult } from "@/lib/admin/questions";

const NUMERIC = new Set(["marks", "year", "estimated_minutes"]);

function coerce(row: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === "") continue;
    if (NUMERIC.has(key)) out[key] = Number(value);
    else if (key === "tags") out[key] = value.split("|").map((t) => t.trim());
    else if (key === "calculator") out[key] = value.toLowerCase() === "true";
    else if (key === "answer_key") {
      // JSON in a CSV cell, e.g. {"accept":["x=2"]} or
      // {"options":["a","b"],"correct":1} — left as-is on a parse error so
      // the row fails validation with a readable reason.
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else out[key] = value;
  }
  return out;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [busy, setBusy] = React.useState(false);

  function reset() {
    setRows([]);
    setResult(null);
  }

  async function onFile(file: File) {
    setResult(null);
    setRows(parseCsv(await file.text()));
  }

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/admin/questions/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows.map(coerce)),
    });
    setBusy(false);
    if (!res.ok) return;
    setResult((await res.json()) as ImportResult);
    onImported();
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import questions</DialogTitle>
          <DialogDescription>
            CSV with a header row. Required columns: subject_id, topic_id,
            prompt. Tags are pipe-separated. For Ranked Duels add
            answer_type (mcq | numeric | exact) and answer_key as JSON, e.g.{" "}
            <code>{'{"accept":["x=2"]}'}</code> or{" "}
            <code>{'{"options":["4","8"],"correct":1}'}</code>.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-6 py-10 text-center text-sm text-muted-foreground hover:border-foreground">
            <FileUp className="h-6 w-6" />
            {rows.length
              ? `${rows.length} row${rows.length === 1 ? "" : "s"} ready`
              : "Drop a CSV here or click to choose"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
        )}

        {!result && rows.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-left font-mono uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    {headers.map((h) => (
                      <td key={h} className="max-w-[14rem] truncate px-3 py-1.5">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <span className="rounded bg-success/15 px-2 py-0.5 font-medium text-success">
                {result.inserted} inserted
              </span>{" "}
              <span className="text-muted-foreground">
                {result.failed} failed
              </span>
            </p>
            {result.failures.length > 0 && (
              <ul className="max-h-48 overflow-auto rounded-lg border border-border p-3 text-xs text-muted-foreground">
                {result.failures.map((f) => (
                  <li key={f.row}>
                    Row {f.row}: {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={busy || rows.length === 0}>
              {busy ? "Importing…" : `Import ${rows.length} rows`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
