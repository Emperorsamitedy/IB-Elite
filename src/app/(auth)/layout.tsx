import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { Gauge } from "@/components/ui/gauge";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms and privacy policy.
        </div>
      </div>

      {/* Brand panel — answer booklet, ruled and margined */}
      <div className="relative hidden overflow-hidden bg-ink text-ink-foreground lg:block">
        <div className="pointer-events-none absolute inset-0 bg-ruled" />
        <div className="pointer-events-none absolute inset-y-0 left-14 w-px bg-accent/50" />
        <div className="relative flex h-full flex-col justify-center pl-20 pr-14">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-foreground/60">
            Year 13 · Economics HL
          </span>
          <p className="mt-5 max-w-md text-balance font-serif text-3xl leading-snug">
            Atlas turned my revision from endless searching into focused
            practice. I know exactly what to do next.
          </p>
          <div className="mt-10 w-56">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-foreground/60">
              Her standing · 6/7
            </p>
            <Gauge value={6} tone="inverse" />
          </div>
        </div>
      </div>
    </div>
  );
}
