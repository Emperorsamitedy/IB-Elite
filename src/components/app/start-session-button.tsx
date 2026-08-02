"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { createSession, type CreateSessionInput } from "@/lib/actions/session";

export function StartSessionButton({
  input,
  children,
  ...props
}: {
  input: CreateSessionInput;
  children: React.ReactNode;
} & ButtonProps) {
  const [pending, start] = React.useTransition();

  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() =>
        start(async () => {
          const res = await createSession(input);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      {pending ? <Spinner /> : children}
    </Button>
  );
}
