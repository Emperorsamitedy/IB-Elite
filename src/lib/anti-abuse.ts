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
