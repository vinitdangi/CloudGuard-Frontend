import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Sign in — CloudGuard",
  description: "Sign in to your CloudGuard AWS security workspace.",
};

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
