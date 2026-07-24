import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { requestPasswordReset } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" serverAction={requestPasswordReset} />;
}
