"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import type { AuthState } from "@/lib/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? <Spinner /> : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  serverAction,
  next,
}: {
  mode: "login" | "register" | "forgot";
  serverAction: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
}) {
  const [state, action] = useActionState(serverAction, null);
  const titles = {
    login: { h: "Welcome back", s: "Sign in to continue revising." },
    register: { h: "Create your account", s: "Start practising in minutes." },
    forgot: {
      h: "Reset your password",
      s: "We'll email you a secure reset link.",
    },
  }[mode];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{titles.h}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{titles.s}</p>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.message && (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3.5 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <form action={action} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}

        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Name (optional)</Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@school.edu"
            autoComplete="email"
            required
          />
        </div>

        {mode !== "forgot" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <Link
                  href="/forgot-password"
                  className="text-xs text-accent hover:underline"
                >
                  Forgot?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </div>
        )}

        <SubmitButton
          label={
            mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Send reset link"
          }
        />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Sign up
            </Link>
          </>
        ) : mode === "register" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
