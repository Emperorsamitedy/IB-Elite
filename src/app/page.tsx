import Link from "next/link";
import { ArrowRight, Search, NotebookPen, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandStamp } from "@/components/ui/stamp";
import { Gauge } from "@/components/ui/gauge";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import {
  APP_NAME,
  CURRENCY_SYMBOL,
  MAX_FEATURES,
  PRICING,
} from "@/lib/constants";

const FEATURES = [
  {
    icon: Search,
    title: "Find any question fast",
    body: "Filter to the exact question by subject, paper, topic and command term. No more scrolling through PDFs.",
  },
  {
    icon: NotebookPen,
    title: "Every mistake, kept",
    body: "Questions you get wrong land in your notebook automatically — ready to redo until they stick.",
  },
  {
    icon: MessageSquareText,
    title: "A tutor that guides",
    body: "Ask for a hint, not the answer. The tutor walks you to the mark scheme one step at a time.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick what to revise",
    body: "Choose a subject and topic, or let Atlas set your next best session.",
  },
  {
    n: "02",
    title: "Practise under exam conditions",
    body: "Work timed, past-paper-style questions in a clean, distraction-free viewer.",
  },
  {
    n: "03",
    title: "Watch your grade climb",
    body: "Reveal the mark scheme, log mistakes, and see each subject move up the 7-gauge.",
  },
];

const CHIP_COLORS = [
  "#E5372A",
  "#2F8F6B",
  "#2B6E8F",
  "#C6892B",
  "#7A4FB0",
  "#B92A5A",
];

export default async function LandingPage() {
  const subjects = env.configured
    ? (
        await (await createClient())
          .from("subjects")
          .select("id, name, group_name, color")
          .order("sort_order")
          .limit(6)
      ).data
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      {!env.configured && (
        <div className="border-b border-accent/40 bg-accent/10">
          <div className="container py-3 font-mono text-xs uppercase tracking-[0.08em]">
            Supabase is not configured. Copy{" "}
            <code className="font-bold">.env.example</code> to{" "}
            <code className="font-bold">.env.local</code> and set{" "}
            <code className="font-bold">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-bold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Hero */}
        <section className="container pt-4 md:pt-6">
          <div className="relative overflow-hidden rounded-2xl bg-ink px-6 py-12 text-ink-foreground sm:px-10 md:px-14 md:py-16">
            <div className="pointer-events-none absolute inset-0 bg-ruled" />
            <div className="pointer-events-none absolute inset-y-0 left-[88px] hidden w-px bg-accent/50 md:block" />
            <div className="relative grid items-center gap-12 md:grid-cols-[1.08fr_.92fr]">
              <div>
                <CommandStamp term="Evaluate" />
                <h1 className="mt-6 text-balance text-[2.75rem] font-black leading-[0.98] tracking-tight sm:text-6xl">
                  Turn past papers into{" "}
                  <span className="marker-hl font-mono text-[0.82em] font-semibold">
                    <span>7s</span>
                  </span>{" "}
                  <span className="font-serif font-medium italic text-highlight">
                    — not stress.
                  </span>
                </h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-foreground/75">
                  Find any IB question by subject, paper and command term.
                  Practise it, reveal the mark scheme, and see your grade climb 1
                  to 7.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button size="lg" asChild>
                    <Link href="/register">
                      Start practising <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="border-[1.5px] border-ink-foreground/40 text-ink-foreground hover:bg-ink-foreground/10"
                    asChild
                  >
                    <a href="#how">See how it works</a>
                  </Button>
                  <span className="font-mono text-xs text-ink-foreground/55">
                    Free · no card needed
                  </span>
                </div>
              </div>

              <SampleQuestionCard />
            </div>
          </div>

          {/* Stats ribbon */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-4">
            <RibbonCell n="1,200+" label="past-paper-style questions" />
            <RibbonCell n="1–7" label="graded like the real exam" tone="accent" />
            <RibbonCell n="6" label="subject groups covered" tone="success" />
            <RibbonCell n="42" label="days to the May session" />
          </div>

          {/* Subject chips */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {(subjects ?? []).map((s, i) => (
              <span
                key={s.id}
                className="flex items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-2.5 pr-4 text-sm font-semibold"
              >
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: s.color ?? CHIP_COLORS[i % 6] }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </section>

        {/* Your standing / 7-gauge signature */}
        <section id="gauge" className="container py-16 md:py-20">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Your standing · the 7-gauge
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                updates every session ▸
              </p>
            </div>
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              <GaugePreview label="Mathematics AA HL" value={5} />
              <GaugePreview label="Economics HL" value={6} />
              <GaugePreview label="Physics HL" value={3} />
            </div>
            <p className="mt-6 max-w-xl font-serif text-[15px] italic leading-relaxed text-muted-foreground">
              One instrument, everywhere: it shows where each subject stands,
              how hard a question is, and how confident you felt — all on the
              scale you&apos;re actually graded on.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border">
          <div className="container py-16 md:py-24">
            <SectionHeading
              eyebrow="What you get"
              title="Built for the way the IB actually works"
            />
            <div className="mt-12 divide-y divide-border border-y border-border">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="grid gap-4 py-8 sm:grid-cols-[1fr_2fr] sm:items-start sm:gap-8"
                >
                  <div className="flex items-center gap-3">
                    <f.icon className="h-5 w-5 text-accent" />
                    <h3 className="text-lg font-bold tracking-tight">
                      {f.title}
                    </h3>
                  </div>
                  <p className="max-w-xl leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border bg-surface-2/40">
          <div className="container py-16 md:py-24">
            <SectionHeading
              eyebrow="How it works"
              title="From “I should revise” to a marked question in seconds"
            />
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-card p-7">
                  <span className="font-mono text-sm font-semibold text-accent">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-bold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-border">
          <div className="container py-16 md:py-24">
            <SectionHeading
              eyebrow="Pricing"
              title="Start free. Go Pro when you're serious."
            />
            <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
              <PricingCard
                name="Free"
                price={`${CURRENCY_SYMBOL}0`}
                cadence="forever"
                features={[
                  "Browse all subjects & topics",
                  "10 practice questions per day",
                  "Basic mistake notebook",
                  "1 exam countdown",
                ]}
                cta="Get started"
                href="/register"
              />
              <PricingCard
                highlighted
                name="Pro"
                price={`${CURRENCY_SYMBOL}${PRICING.pro.monthly.amount}`}
                cadence="per month"
                features={[
                  "Unlimited practice sessions",
                  "AI tutor with hint ladder",
                  "Personalised study plans",
                  "Full mistake notebook & the 7-gauge",
                  "Unlimited exam countdowns",
                ]}
                cta="Start Pro"
                href="/register?plan=pro"
              />
              <PricingCard
                name="Max"
                price={`${CURRENCY_SYMBOL}${PRICING.max.monthly.amount}`}
                cadence="per month"
                features={["Everything in Pro", ...MAX_FEATURES]}
                cta="Coming soon"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="container py-16 md:py-20">
            <div className="relative overflow-hidden rounded-2xl bg-ink px-6 py-14 text-center text-ink-foreground">
              <div className="pointer-events-none absolute inset-0 bg-ruled" />
              <h2 className="relative text-balance text-3xl font-black tracking-tight sm:text-4xl">
                Your revision desk is ready.
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-ink-foreground/75">
                Join students turning past papers into 7s with {APP_NAME}.
              </p>
              <Button size="lg" className="relative mt-7" asChild>
                <Link href="/register">
                  Start practising <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <Logo />
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME} · built for IB students
          </p>
          <div className="flex gap-5 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SampleQuestionCard() {
  return (
    <div className="overflow-hidden rounded-lg bg-card text-card-foreground shadow-2xl">
      <div className="flex items-center justify-between bg-ink-2 px-4 py-3 font-mono text-[11px] tracking-wide text-ink-foreground/80">
        <span>PAPER 2 · SECTION B</span>
        <span>NO CALCULATOR</span>
      </div>
      <div className="grid grid-cols-[56px_1fr]">
        <div className="flex flex-col items-center gap-4 border-r border-border bg-surface-2 py-4 font-mono text-xs text-muted-foreground">
          <span className="font-semibold text-accent">[6]</span>
          <span>3</span>
          <span className="mt-auto">00:45</span>
        </div>
        <div className="p-5">
          <p className="font-mono text-xs text-muted-foreground">
            Question 3 · Economics HL
          </p>
          <CommandStamp term="Evaluate" arrow={false} className="my-2.5" />
          <p className="font-serif text-lg leading-snug">
            Evaluate the extent to which a rise in interest rates reduces
            inflation in a closed economy.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Reveal mark scheme
          </Button>
          <div className="mt-4 border-t border-dashed border-border pt-3">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
              HOW CONFIDENT? · snaps onto your 7-gauge
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GaugePreview({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          now <b className="text-sm text-accent">{value}</b>/7
        </span>
      </div>
      <Gauge value={value} />
    </div>
  );
}

function RibbonCell({
  n,
  label,
  tone,
}: {
  n: string;
  label: string;
  tone?: "accent" | "success";
}) {
  return (
    <div className="border-b border-r border-border p-5 last:border-r-0 md:border-b-0">
      <div
        className={
          "font-mono text-2xl font-semibold " +
          (tone === "accent"
            ? "text-accent"
            : tone === "success"
              ? "text-success"
              : "text-foreground")
        }
      >
        {n}
      </div>
      <div className="mt-1.5 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-black tracking-tight sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-balance text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function PricingCard({
  name,
  price,
  cadence,
  features,
  cta,
  href,
  highlighted,
}: {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  /** Omitted for a tier that isn't on sale yet. */
  href?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        "relative flex flex-col rounded-xl border bg-card p-6 " +
        (highlighted ? "border-accent" : "border-border")
      }
    >
      {highlighted && (
        <span className="absolute -top-3 right-6 rounded-[3px] bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
          Most popular
        </span>
      )}
      <h3 className="font-mono text-sm font-semibold uppercase tracking-wide">
        {name}
      </h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-accent" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <Button
          className="mt-7"
          variant={highlighted ? "primary" : "outline"}
          asChild
        >
          <Link href={href}>{cta}</Link>
        </Button>
      ) : (
        <Button className="mt-7" variant="outline" disabled>
          {cta}
        </Button>
      )}
    </div>
  );
}
