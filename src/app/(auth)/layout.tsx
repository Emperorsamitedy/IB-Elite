import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Quote } from "lucide-react";

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

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-l border-border bg-surface lg:block">
        <div className="absolute inset-0 bg-grid bg-radial-fade opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <Quote className="h-10 w-10 text-accent" />
          <p className="mt-6 max-w-md text-balance text-2xl font-medium leading-snug tracking-tight">
            Atlas turned my revision from endless searching into focused
            practice. I finally know exactly what to do next.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            An IB student, Year 13
          </p>
        </div>
      </div>
    </div>
  );
}
