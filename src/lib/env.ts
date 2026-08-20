function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/**
 * Read lazily so a missing variable surfaces on the request that needs it
 * rather than at import time, which would break `next build`.
 */
export const env = {
  get supabaseUrl(): string {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey(): string {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
  get configured(): boolean {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
};

/** Server-only secrets — never import from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // Free-tier OCR for the whiteboard scanner. Both are optional: with no keys
  // at all, scanning falls back to OCR.space's public demo key.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // `STRIPE_PRICE_MONTHLY`/`_ANNUAL` are the pre-Max names, still honoured.
  stripePriceProMonthly:
    process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.STRIPE_PRICE_MONTHLY ?? "",
  stripePriceProAnnual:
    process.env.STRIPE_PRICE_PRO_ANNUAL ?? process.env.STRIPE_PRICE_ANNUAL ?? "",
  stripePriceMaxMonthly: process.env.STRIPE_PRICE_MAX_MONTHLY ?? "",
};

export const featureFlags = {
  ai: Boolean(process.env.OPENAI_API_KEY),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  // Scanning always works — the OCR.space demo key needs no configuration.
  scan: true,
};
