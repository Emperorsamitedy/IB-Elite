"use client";

import * as React from "react";
import { ImageUp, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Image picker with drag-and-drop, a camera path on mobile and a preview of
 * the chosen file. Rejects oversized or wrong-typed files here rather than
 * letting the upload fail server-side.
 */
export function FileDropzone({
  id,
  file,
  onFile,
  accept = ["image/jpeg", "image/png", "image/webp"],
  maxBytes = 1024 * 1024,
  hint = "JPG or PNG up to 1 MB",
  className,
}: {
  id: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string[];
  maxBytes?: number;
  hint?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accepted = React.useCallback(
    (candidate: File) => {
      if (accept.length > 0 && !accept.includes(candidate.type)) {
        setError("That file type isn't supported.");
        return false;
      }
      if (candidate.size > maxBytes) {
        setError(`That file is ${formatBytes(candidate.size)} — the limit is ${formatBytes(maxBytes)}.`);
        return false;
      }
      setError(null);
      return true;
    },
    [accept, maxBytes],
  );

  const choose = (candidate: File | undefined) => {
    if (!candidate) return;
    if (accepted(candidate)) onFile(candidate);
  };

  if (file && preview) {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt=""
          className="size-16 shrink-0 rounded-md border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {formatBytes(file.size)} · ready to upload
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          aria-label="Remove photo"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-accent bg-accent/5"
            : "border-border bg-surface-2 hover:border-foreground/40",
        )}
      >
        <ImageUp className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag a photo here, or
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Choose a photo
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          >
            <Camera className="size-3.5" /> Camera
          </button>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {hint}
        </p>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept.join(",")}
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
