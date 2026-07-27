import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 26 26"
        fill="none"
        className="h-[26px] w-[26px]"
        aria-hidden="true"
      >
        <path
          d="M13 1.5 24 8v10L13 24.5 2 18V8L13 1.5Z"
          className="stroke-foreground"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M13 24.5V13L2 8"
          className="stroke-accent"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="13" cy="13" r="1.9" className="fill-accent" />
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
      )}
    </span>
  );
}
