"use client";

import * as React from "react";
import { Copy, ScanLine, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ScanOutcome = {
  text: string;
  provider: string;
  message?: string;
  source: "photo" | "board";
};

export function ScanResultDialog({
  outcome,
  onOpenChange,
  onAddToBoard,
}: {
  outcome: ScanOutcome | null;
  onOpenChange: (open: boolean) => void;
  onAddToBoard: (text: string) => void;
}) {
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    setText(outcome?.text ?? "");
  }, [outcome]);

  return (
    <Dialog open={Boolean(outcome)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-accent" />
            {outcome?.source === "board"
              ? "Your working, transcribed"
              : "Scanned text"}
          </DialogTitle>
          <DialogDescription>
            {outcome?.text
              ? "Check it over — OCR isn't perfect with handwriting. Edit anything it misread."
              : (outcome?.message ??
                "Nothing was recognised in that image.")}
          </DialogDescription>
        </DialogHeader>

        {outcome?.text ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="font-mono text-xs leading-relaxed"
              aria-label="Recognised text"
            />
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">Read by {outcome.provider}</Badge>
              <DialogFooter className="flex-row gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(text);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onAddToBoard(text);
                    onOpenChange(false);
                  }}
                >
                  <Type className="h-4 w-4" /> Add to board
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
