import Link from "next/link";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { AcceptChallengeButton } from "@/components/duel/accept-challenge-button";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: "Duel challenge" };

const t = messages.duel;

/**
 * Public landing for a challenge link. Works logged out — the whole point is
 * that the link converts a friend into a signup: the CTA routes through
 * /register with `next` pointing back here, and acceptance is attributed.
 */
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: challenge } = await admin
    .from("duel_challenges")
    .select(
      "id, token, creator_id, subject_id, mode, claimed_by, expires_at, subjects(name)",
    )
    .eq("token", token)
    .maybeSingle();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Attribution: every landing is recorded, signed in or not.
  await admin.from("analytics_events").insert({
    user_id: user?.id ?? null,
    name: "challenge_link_visited",
    props: { token, found: Boolean(challenge) },
  });

  const expired =
    !challenge ||
    challenge.claimed_by !== null ||
    new Date(challenge.expires_at).getTime() < Date.now();

  let creatorName = "A student";
  if (challenge) {
    const { data: creator } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", challenge.creator_id)
      .maybeSingle();
    creatorName = creator?.display_name ?? creatorName;
  }
  const subjectName = challenge
    ? ((challenge.subjects as { name?: string } | null)?.name ?? "their subject")
    : "";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <Swords className="h-8 w-8 text-accent" />
        {expired ? (
          <>
            <p className="text-sm text-muted-foreground">{t.challengeExpired}</p>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold tracking-tight">
              {creatorName} {t.challengeHeading}
            </h1>
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {subjectName} ·{" "}
              {challenge!.mode === "ranked" ? "ranked" : "friendly"}
            </p>
            <p className="text-sm text-muted-foreground">{t.challengeBody}</p>
            {user ? (
              <AcceptChallengeButton token={token} />
            ) : (
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={`/register?next=/duel/challenge/${token}`}>
                    {t.acceptSignedOut}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/login?next=/duel/challenge/${token}`}>
                    Sign in
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
