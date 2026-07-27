"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "!bg-card !text-card-foreground !border-border !rounded-lg !shadow-lg",
            description: "!text-muted-foreground",
          },
        }}
      />
    </ThemeProvider>
  );
}
