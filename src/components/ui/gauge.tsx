import { cn } from "@/lib/utils";

type GaugeSize = "sm" | "md" | "lg";
type GaugeTone = "default" | "inverse";

const HEIGHTS = [30, 42, 54, 66, 78, 89, 100];

const SIZE: Record<GaugeSize, { track: string; num: string; gap: string }> = {
  sm: { track: "h-8", num: "text-[10px]", gap: "gap-[3px]" },
  md: { track: "h-14", num: "text-xs", gap: "gap-1" },
  lg: { track: "h-20", num: "text-sm", gap: "gap-1.5" },
};

/**
 * The 7-gauge — Atlas's signature. A precision seven-notch instrument built on
 * the IB 1–7 grade scale. Reached notches are ink, the achieved band is marker
 * red, and the rest stay paper. Notches grow on mount; `prefers-reduced-motion`
 * disables that. Use `tone="inverse"` on ink panels.
 */
export function Gauge({
  value,
  max = 7,
  size = "md",
  tone = "default",
  animate = true,
  showNumbers = true,
  className,
}: {
  value: number;
  max?: number;
  size?: GaugeSize;
  tone?: GaugeTone;
  animate?: boolean;
  showNumbers?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  const inverse = tone === "inverse";
  const notches = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div
      role="img"
      aria-label={`Grade ${value} of ${max}`}
      className={cn("grid items-end", s.track, s.gap, className)}
      style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}
    >
      {notches.map((n) => {
        const on = n <= value;
        const peak = n === value;
        const h =
          HEIGHTS[Math.round(((n - 1) / (max - 1)) * (HEIGHTS.length - 1))];
        return (
          <div
            key={n}
            className="flex h-full flex-col items-center justify-end gap-1.5"
          >
            <div
              className={cn(
                "w-full origin-bottom rounded-[2px] border",
                peak
                  ? "border-accent-deep bg-accent"
                  : on
                    ? inverse
                      ? "border-ink-foreground bg-ink-foreground"
                      : "border-ink bg-ink dark:border-foreground dark:bg-foreground"
                    : inverse
                      ? "border-ink-foreground/25 bg-ink-foreground/10"
                      : "border-border bg-surface-2",
                animate && "motion-safe:animate-gauge-grow",
              )}
              style={{
                height: `${h}%`,
                animationDelay: animate ? `${n * 55}ms` : undefined,
              }}
            />
            {showNumbers && (
              <span
                aria-hidden
                className={cn(
                  "font-mono leading-none",
                  s.num,
                  inverse
                    ? on
                      ? "font-semibold text-ink-foreground"
                      : "text-ink-foreground/50"
                    : on
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {n}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
