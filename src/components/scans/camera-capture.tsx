"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Live camera capture. The mobile `capture` file input only exists on phones,
 * so a laptop webcam had no path to taking a photo at all — this gives both
 * one, with a preview so the student can see the page is in frame.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open a camera. Choose a photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError(
          "We could not open the camera. Allow camera access, or choose a photo instead.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  const take = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "camera.jpg", { type: "image/jpeg" }));
        stop();
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }, [onCapture, onClose, stop]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3">
      <div className="relative overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="max-h-[60vh] w-full object-contain"
        />
        {!ready && !error && (
          <p className="absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.08em] text-white/70">
            Starting camera…
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Fill the frame with your working and keep the page flat
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={take} disabled={!ready}>
          <Camera className="mr-2 size-4" /> Take photo
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            stop();
            onClose();
          }}
        >
          <X className="mr-2 size-4" /> Cancel
        </Button>
        {error && (
          <Button variant="ghost" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}
