import type { Metadata } from "next";
import { PasswordResetPage } from "@/components/auth/password-reset-page";

export const metadata: Metadata = {
  title: "Reset password — CloudGuard",
  description: "Request a secure CloudGuard password reset link.",
};

export default function ForgotPasswordPage() {
  return <PasswordResetPage mode="forgot" />;
}
