"use client";

import * as React from "react";
import Link from "next/link";
import Script from "next/script";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import { signInWithGoogle, type AuthState } from "@/lib/actions/auth";

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
  mode: "login" | "register" | "forgot" | "reset";
  serverAction: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
}) {
  const [state, action] = useActionState(serverAction, null);
  const [googleState, googleAction] = useActionState(signInWithGoogle, null);
  const error = state?.error ?? googleState?.error;
  const titles = {
    login: { h: "Welcome back", s: "Sign in to continue revising." },
    register: { h: "Create your account", s: "Start practising in minutes." },
    forgot: {
      h: "Reset your password",
      s: "We'll email you a secure reset link.",
    },
    reset: {
      h: "Choose a new password",
      s: "Use at least 8 characters. You'll stay signed in afterwards.",
    },
  }[mode];
  const showOAuth = mode === "login" || mode === "register";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{titles.h}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{titles.s}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
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

        {mode !== "reset" && (
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
        )}

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
              minLength={mode === "login" ? undefined : 8}
              required
            />
          </div>
        )}

        {mode === "register" &&
          process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <>
              <Script
                src="https://challenges.cloudflare.com/turnstile/api.js"
                strategy="lazyOnload"
              />
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-theme="auto"
              />
            </>
          )}

        {mode === "reset" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        )}

        <SubmitButton
          label={
            {
              login: "Sign in",
              register: "Create account",
              forgot: "Send reset link",
              reset: "Set new password",
            }[mode]
          }
        />
      </form>

      {showOAuth && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={googleAction}>
            {next && <input type="hidden" name="next" value={next} />}
            <GoogleButton />
          </form>
        </>
      )}

      {mode !== "reset" && (
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
      )}
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      size="lg"
      disabled={pending}
    >
      {pending ? (
        <Spinner />
      ) : (
        <>
          <GoogleMark />
          Continue with Google
        </>
      )}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
