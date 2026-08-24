"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Ticking countdown to an absolute instant; reloads the page when it hits. */
export function Countdown({
  to,
  reloadOnZero = false,
  className,
}: {
  to: string;
  reloadOnZero?: boolean;
  className?: string;
}) {
  const [left, setLeft] = useState(() => new Date(to).getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = new Date(to).getTime() - Date.now();
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        if (reloadOnZero) window.location.reload();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [to, reloadOnZero]);

  return (
    <span className={className} suppressHydrationWarning>
      {format(left)}
    </span>
  );
}
