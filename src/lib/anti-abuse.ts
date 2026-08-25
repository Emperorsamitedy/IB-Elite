import "server-only";
import { createHash } from "node:crypto";
import { serverEnv, featureFlags } from "@/lib/env";

/**
 * Salted, truncated hash of the caller's network address. Raw IPs are never
 * stored (the user base is minors); the hash is only ever compared for
 * equality to keep ranked duels off shared networks.
 */
export function ipHashFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  if (!ip) return null;
  return createHash("sha256")
    .update(`${serverEnv.ipHashSalt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Cloudflare Turnstile verification. When the keys aren't configured the
 * check passes — the flag controls whether the widget renders at all.
 */
export async function verifyTurnstile(
  token: string | null,
  remoteIp?: string | null,
): Promise<boolean> {
  if (!featureFlags.turnstile) return true;
  if (!token) return false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: serverEnv.turnstileSecretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
      },
    );
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    // Verification outage must not lock every student out of signup.
    return true;
  }
}

import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { max: number; windowSeconds: number };

/** Per-route budgets — generous for honest use, hostile to scripts. */
export const RATE_LIMITS = {
  scan: { max: 30, windowSeconds: 3600 },
  scanUpload: { max: 40, windowSeconds: 3600 },
  duelQueue: { max: 30, windowSeconds: 600 },
  duelAnswer: { max: 120, windowSeconds: 600 },
  challengeCreate: { max: 15, windowSeconds: 3600 },
  mockScript: { max: 40, windowSeconds: 3600 },
  mockAction: { max: 60, windowSeconds: 600 },
  duelPoll: { max: 200, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window limiter backed by Postgres, so every serverless instance
 * shares one budget. Fails OPEN: a database hiccup must degrade to
 * "unlimited", never to "everyone blocked".
 */
export async function rateLimitOk(
  scope: keyof typeof RATE_LIMITS,
  subject: string,
): Promise<boolean> {
  const rule = RATE_LIMITS[scope];
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: `${scope}:${subject}`,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

export const RATE_LIMITED_MESSAGE =
  "You're doing that a little too fast — give it a minute and try again.";
