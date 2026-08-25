"use client";

import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n/en";

export function ShareCardButton({ entryId }: { entryId: string }) {
  const copy = async () => {
    const url = `${window.location.origin}/api/mock/card/${entryId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success(messages.mock.shareCopied);
  };
  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()}>
      <Share2 className="mr-2 size-4" /> {messages.mock.shareCard}
    </Button>
  );
}
