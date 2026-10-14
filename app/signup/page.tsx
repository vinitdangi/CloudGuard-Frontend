import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Create account — CloudGuard",
  description: "Create an account for your CloudGuard AWS security workspace.",
};

export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
