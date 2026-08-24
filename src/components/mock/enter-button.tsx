"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { messages } from "@/lib/i18n/en";

export function EnterSittingButton({ sittingId }: { sittingId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const enter = async () => {
    setPending(true);
    const res = await fetch("/api/mock/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sittingId }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      toast.error(body?.error ?? "Could not enter");
      return;
    }
    router.refresh();
  };

  return (
    <Button onClick={() => void enter()} disabled={pending} size="sm">
      {pending ? <Spinner /> : <Ticket className="mr-2 size-4" />}
      {messages.mock.enter}
    </Button>
  );
}
