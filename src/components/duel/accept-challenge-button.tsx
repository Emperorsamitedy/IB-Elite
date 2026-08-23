"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { messages } from "@/lib/i18n/en";

export function AcceptChallengeButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/duel/challenge/${token}/accept`, {
      method: "POST",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setPending(false);
      setError(body?.error ?? "Could not accept the challenge");
      return;
    }
    router.push(`/duel/${body.matchId}`);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={() => void accept()} disabled={pending}>
        {pending ? <Spinner /> : <Swords className="mr-2 size-4" />}
        {messages.duel.accept}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
