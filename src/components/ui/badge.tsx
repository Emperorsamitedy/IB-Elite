import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface-2 text-muted-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
        success: "border-success/40 bg-success/10 text-success",
        warning: "border-highlight bg-highlight/25 text-foreground",
        danger: "border-accent/40 bg-accent/10 text-accent",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
