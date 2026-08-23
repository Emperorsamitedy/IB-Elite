import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { updatePassword } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * Landing page for the password-reset email. The link arrives via
 * /auth/callback, which exchanges the recovery code for a session; the
 * middleware sends anyone without one back to /login.
 */
export default function ResetPasswordPage() {
  return <AuthForm mode="reset" serverAction={updatePassword} />;
}
