import type { Metadata } from "next";
import { PasswordResetPage } from "@/components/auth/password-reset-page";

export const metadata: Metadata = {
  title: "Choose a new password — CloudGuard",
  description: "Set a new password for your CloudGuard account.",
};

export default function ResetPasswordPage() {
  return <PasswordResetPage mode="reset" />;
}
