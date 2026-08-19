"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AnnotationResult, ScanStatus } from "@/lib/scans/types";

const POLL_INTERVAL_MS = 2000;

export type QuestionOption = { id: string; label: string };

type ScanState = {
  scanId: string;
  status: ScanStatus;
  imageUrl: string | null;
  errorMessage: string | null;
  annotationResult: AnnotationResult | null;
};

/**
 * Upload a photo of handwritten work and overlay mark-scheme annotations.
 * With a single question option the picker is hidden, so the same component
 * serves the standalone page and the in-session slide-over.
 */
export function ScanMarker({
  questions,
  bare = false,
}: {
  questions: QuestionOption[];
  bare?: boolean;
}) {
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // OCR boxes are in original-image pixels but the image renders scaled,
  // so overlays are positioned as percentages of the natural size.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const submit = useCallback(async () => {
    if (!file || !questionId) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("questionId", questionId);
      const response = await fetch("/api/scans", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Upload failed");
      setScan({
        scanId: payload.scanId,
        status: payload.status,
        imageUrl: null,
        errorMessage: null,
        annotationResult: null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file, questionId]);

  const scanId = scan?.scanId;
  const settled = scan?.status === "ANNOTATED" || scan?.status === "FAILED";

  useEffect(() => {
    if (!scanId || settled) return;

    const poll = async () => {
      const response = await fetch(`/api/scans/${scanId}`);
      if (!response.ok) return;
      const payload = await response.json();
      setScan({
        scanId: payload.scanId,
        status: payload.status,
        imageUrl: payload.imageUrl ?? null,
        errorMessage: payload.errorMessage ?? null,
        annotationResult: payload.annotationResult ?? null,
      });
    };

    void poll();
    timer.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [scanId, settled]);

  const form = (
    <div className="flex flex-col gap-4">
      {questions.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="scan-question">Question</Label>
          <select
            id="scan-question"
            value={questionId}
            onChange={(event) => setQuestionId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="scan-file">Photo of your work</Label>
        <input
          id="scan-file"
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          JPG or PNG up to 1 MB
        </p>
      </div>

      <Button onClick={submit} disabled={!file || !questionId || uploading}>
        <Upload className="mr-2 size-4" />
        {uploading ? "Uploading…" : "Upload and mark"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  const result = scan && (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs uppercase tracking-[0.08em]">
        {scan.status === "ANNOTATED"
          ? `Marked · ${scan.annotationResult?.awarded ?? 0}/${scan.annotationResult?.total ?? 0}`
          : scan.status === "FAILED"
            ? `Failed · ${scan.errorMessage ?? "unknown error"}`
            : "Marking your work…"}
      </p>

      {scan.imageUrl && (
        <div className="relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scan.imageUrl}
            alt="Your uploaded answer"
            className="max-w-full rounded-md border border-border"
            onLoad={(event) =>
              setSize({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              })
            }
          />
          {size &&
            scan.annotationResult?.markPoints.map((point, index) =>
              point.box ? (
                <span
                  key={`${point.text}-${index}`}
                  title={`${point.present ? "Awarded" : "Missing"}: ${point.text}`}
                  className={`pointer-events-none absolute border-2 ${
                    point.present ? "border-success" : "border-danger"
                  }`}
                  style={{
                    left: `${(point.box.x / size.w) * 100}%`,
                    top: `${(point.box.y / size.h) * 100}%`,
                    width: `${(point.box.width / size.w) * 100}%`,
                    height: `${(point.box.height / size.h) * 100}%`,
                  }}
                />
              ) : null,
            )}
        </div>
      )}

      {scan.annotationResult && (
        <ul className="flex flex-col gap-1 text-sm">
          {scan.annotationResult.markPoints.map((point, index) => (
            <li key={`${point.text}-${index}`} className="flex gap-2">
              <span className={point.present ? "text-success" : "text-danger"}>
                {point.present ? "✓" : "✗"}
              </span>
              <span>{point.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-6">
        {form}
        {result}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="py-6">{form}</CardContent>
      </Card>
      {result && (
        <Card>
          <CardContent className="py-6">{result}</CardContent>
        </Card>
      )}
    </div>
  );
}
