import Link from "next/link";
import {
  ArrowRight,
  Search,
  Target,
  NotebookPen,
  Sparkles,
  CalendarRange,
  Timer,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, PRICING } from "@/lib/constants";

const FEATURES = [
  {
    icon: Search,
    title: "Find questions instantly",
    body: "Filter by subject, topic, difficulty, paper and more. The right question is always seconds away.",
  },
  {
    icon: Target,
    title: "Practise by topic",
    body: "Build focused sessions in a couple of taps — pick a topic, a difficulty, and go.",
  },
  {
    icon: NotebookPen,
    title: "Learn from mistakes",
    body: "Every question you get wrong lands in your mistake notebook, ready to revisit and master.",
  },
  {
    icon: Sparkles,
    title: "AI tutor that teaches",
    body: "Context-aware hints that guide you to the answer instead of handing it over.",
  },
  {
    icon: CalendarRange,
    title: "Personalised revision",
    body: "A study plan built around your subjects, exam dates and weak topics.",
  },
  {
    icon: Timer,
    title: "Exam countdowns",
    body: "Always know how many days remain and exactly what to focus on next.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Choose what to revise",
    body: "Select a subject and topic, or let Atlas recommend your next best session.",
  },
  {
    n: "02",
    title: "Practise with focus",
    body: "Work through curated questions with a clean, distraction-free viewer.",
  },
  {
    n: "03",
    title: "Understand & improve",
    body: "Ask the AI tutor, save mistakes, and watch your weak topics shrink.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, group_name, color")
    .order("sort_order")
    .limit(6);

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid bg-radial-fade opacity-60" />
          <div className="container flex flex-col items-center gap-12 py-16 md:py-24">
            <div className="flex max-w-3xl flex-col items-center text-center">
              <Badge variant="accent" className="mb-5 animate-fade-in">
                <Zap className="h-3 w-3" /> Built for IB students
              </Badge>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Stop searching for questions.
                <br />
                <span className="text-accent">Start preparing smarter.</span>
              </h1>
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
                A fast, intelligent IB revision platform that helps you find
                exactly what you need, practise efficiently, understand your
                mistakes, and build a personalised revision plan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start practising <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required · Free to get started
              </p>
            </div>

            <div className="w-full animate-fade-up">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Subjects */}
        <section id="subjects" className="border-t border-border bg-surface/50">
          <div className="container py-16 md:py-20">
            <SectionHeading
              eyebrow="Subjects"
              title="Every subject, one calm home"
              subtitle="Practice curated across the IB curriculum. Pick yours and dive in."
            />
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(subjects ?? []).map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-lg"
                    style={{
                      backgroundColor: `${s.color}1a`,
                      border: `1px solid ${s.color}40`,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.group_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border">
          <div className="container py-16 md:py-24">
            <SectionHeading
              eyebrow="Features"
              title="Everything you need to revise well"
              subtitle="No clutter. No noise. Just the tools that move your grade."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border bg-surface/50">
          <div className="container py-16 md:py-24">
            <SectionHeading
              eyebrow="How it works"
              title="From “I need to revise” to solving a question in seconds"
            />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="relative">
                  <span className="font-mono text-sm font-medium text-accent">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
              title="Simple, student-friendly pricing"
              subtitle="Start free. Upgrade when you're ready for the full toolkit."
            />
            <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
              <PricingCard
                name="Free"
                price="£0"
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
                price={`£${PRICING.monthly.amount}`}
                cadence="per month"
                features={[
                  "Unlimited practice sessions",
                  "AI tutor with hint ladder",
                  "Personalised study plans",
                  "Full mistake notebook & analytics",
                  "Unlimited exam countdowns",
                ]}
                cta="Start Pro"
                href="/register?plan=pro"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-surface/50">
          <div className="container py-16 md:py-20">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-grid bg-radial-fade opacity-40" />
              <h2 className="text-balance text-3xl font-semibold tracking-tight">
                Your revision space is ready.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Join students revising smarter with {APP_NAME}.
              </p>
              <Button size="lg" className="mt-7" asChild>
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
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. Built for IB students.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
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
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
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
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? "border-accent/40 bg-card shadow-glow"
          : "border-border bg-card"
      }`}
    >
      {highlighted && (
        <Badge variant="accent" className="absolute -top-3 right-6">
          Most popular
        </Badge>
      )}
      <h3 className="text-sm font-semibold">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-7"
        variant={highlighted ? "primary" : "outline"}
        asChild
      >
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
