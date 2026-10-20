"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { AsciiScene } from "@/components/landing/ascii-scene";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api/client";
import { forgotPassword, resetPassword } from "@/lib/api/auth";

type PasswordResetMode = "forgot" | "reset";
type Feedback = { kind: "error" | "success"; message: string } | null;

const inputClassName = "h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70";

function PasswordResetField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? "true" : undefined} className="gap-2">
      <FieldLabel htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/65">
        {label}
      </FieldLabel>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function PasswordResetPage({ mode }: { mode: PasswordResetMode }) {
  const isForgot = mode === "forgot";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [tokenReady, setTokenReady] = useState(isForgot);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (isForgot) return;
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token")?.trim() ?? "";
    setToken(resetToken);
    setTokenReady(true);
    if (resetToken) {
      // Keep the bearer token out of the address bar and subsequent navigation history.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [isForgot]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setFeedback(null);
    setFieldError("");

    if (isForgot) {
      if (!identifier.trim()) {
        setFieldError("Enter your email or username.");
        return;
      }
      setLoading(true);
      try {
        const response = await forgotPassword({ identifier: identifier.trim() });
        setFeedback({ kind: "success", message: response.message });
      } catch (error) {
        setFeedback({
          kind: "error",
          message: apiErrorMessage(error, "The password reset request could not be completed. Try again."),
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!tokenReady || !token) {
      setFeedback({
        kind: "error",
        message: "This reset link is missing a token. Request a new password reset link.",
      });
      return;
    }
    if (password.length < 8) {
      setFieldError("Use at least 8 characters.");
      return;
    }
    if (password.length > 1024) {
      setFieldError("Password is too long.");
      return;
    }
    if (!confirmation) {
      setFieldError("Confirm your new password.");
      return;
    }
    if (password !== confirmation) {
      setFieldError("Your passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({ token, password, confirmation });
      setFeedback({ kind: "success", message: response.message });
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setFeedback({
        kind: "error",
        message: apiErrorMessage(error, "The password could not be reset. The link may have expired or already been used."),
      });
    } finally {
      setLoading(false);
    }
  };

  const heading = isForgot ? "Reset your password" : "Choose a new password";
  const description = isForgot
    ? "Enter the email or username for your CloudGuard account. If an account matches, we’ll send a reset link."
    : "Create a new password for your CloudGuard account. You’ll sign in with it after the reset.";
  const success = feedback?.kind === "success";
  const missingToken = !isForgot && tokenReady && !token && !feedback;

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#080a09] text-white selection:bg-[#eca8d6]/35">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_16%,rgba(90,150,120,0.13),transparent_44%),radial-gradient(ellipse_at_85%_70%,rgba(236,168,214,0.07),transparent_43%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:88px_88px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
        <div className="absolute -right-28 top-[18%] size-[32rem] rounded-full border border-white/[0.035] cg-auth-orbit" />
        <div className="absolute -right-12 top-[24%] size-[22rem] rounded-full border border-emerald-100/[0.07] cg-auth-orbit-reverse" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
        <Link href="/" aria-label="CloudGuard home" className="group flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <span className="font-display text-[1.7rem] tracking-tight text-white transition-opacity group-hover:opacity-75">CloudGuard</span>
          <span className="hidden border-l border-white/20 pl-3 pt-0.5 font-mono text-[9px] tracking-[0.18em] text-white/45 sm:inline">AWS SECURITY</span>
        </Link>
        <Link href="/login" className="group inline-flex items-center gap-1.5 py-2 text-xs font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:text-sm">
          Sign In <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-8 px-5 pb-6 sm:px-8 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.78fr)] lg:gap-16 lg:px-12 lg:pb-14">
        <section aria-label="CloudGuard security" className="relative hidden min-h-[560px] flex-col justify-between overflow-hidden py-8 lg:flex">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.23] [mask-image:radial-gradient(ellipse_at_48%_44%,black_5%,transparent_70%)]"><AsciiScene /></div>
          <div className="relative z-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45"><span className="size-1.5 rounded-full bg-emerald-200/80 shadow-[0_0_14px_rgba(167,243,208,0.8)]" />Secure access · AWS control plane</div>
          <div className="relative z-10 max-w-[580px] py-10">
            <p className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45"><span className="h-px w-9 bg-white/30" />Clarity at every layer</p>
            <h1 className="max-w-[560px] font-display text-[clamp(3.8rem,7vw,7.2rem)] leading-[0.92] tracking-[-0.055em] text-white">See what gets in.</h1>
            <p className="mt-7 max-w-[390px] text-sm leading-7 text-white/55">A clearer view of your AWS security posture starts with a more secure way in.</p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35"><span>Identity · Access · Assurance</span><span>CG / 01</span></div>
        </section>

        <section aria-labelledby="password-reset-title" className="cg-auth-enter mx-auto w-full max-w-[470px] py-3 lg:py-8">
          <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 sm:mb-8 lg:hidden"><span className="size-1.5 rounded-full bg-emerald-200/80 shadow-[0_0_14px_rgba(167,243,208,0.8)]" />Secure access · AWS control plane</div>
          <div className="mb-6 sm:mb-8">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45"><LockKeyhole aria-hidden="true" className="size-3.5" />Account recovery</div>
            <h2 id="password-reset-title" className="font-display text-4xl leading-[1.05] tracking-tight sm:text-[2.7rem]">{heading}</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">{description}</p>
          </div>

          {success ? (
            <div className="flex flex-col gap-5">
              <div role="status" aria-live="polite" className="border border-emerald-300/25 bg-emerald-300/[0.07] px-3.5 py-3 text-xs leading-5 text-emerald-100">{feedback?.message}</div>
              <Button asChild className="group relative h-12 w-full justify-between rounded-none bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#101210] hover:bg-white/90">
                <Link href="/login"><span>Sign In</span><ArrowDownRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" /></Link>
              </Button>
            </div>
          ) : missingToken ? (
            <div className="flex flex-col gap-5">
              <div role="alert" className="border border-rose-300/25 bg-rose-300/[0.07] px-3.5 py-3 text-xs leading-5 text-rose-100">This reset link is missing a token. Request a new password reset link.</div>
              <Button asChild variant="outline" className="h-11 rounded-none border-white/25 bg-transparent text-[11px] uppercase tracking-[0.16em] text-white hover:bg-white/10 hover:text-white"><Link href="/forgot-password">Request a new link</Link></Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="flex flex-col gap-4 sm:gap-5">
              {isForgot ? (
                <PasswordResetField id="identifier" label="Email or username" error={fieldError}>
                  <Input id="identifier" name="identifier" type="text" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFieldError(""); setFeedback(null); }} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "identifier-error" : undefined} className={inputClassName} placeholder="name@company.com" />
                </PasswordResetField>
              ) : (
                <>
                  <PasswordResetField id="new-password" label="New password" error={fieldError}>
                    <Input id="new-password" name="password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldError(""); setFeedback(null); }} autoComplete="new-password" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "new-password-error" : undefined} className={inputClassName} />
                  </PasswordResetField>
                  <PasswordResetField id="confirm-password" label="Confirm password" error={fieldError.includes("match") || fieldError.includes("Confirm") ? fieldError : undefined}>
                    <Input id="confirm-password" name="confirmation" type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setFieldError(""); setFeedback(null); }} autoComplete="new-password" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "confirm-password-error" : undefined} className={inputClassName} />
                  </PasswordResetField>
                  <p className="flex items-start gap-2 text-[11px] leading-5 text-white/40"><ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-100/70" />Use at least 8 characters. You’ll need to sign in after resetting your password.</p>
                </>
              )}

              {feedback ? <div role="alert" aria-live="polite" className="border border-rose-300/25 bg-rose-300/[0.07] px-3.5 py-3 text-xs leading-5 text-rose-100">{feedback.message}</div> : null}
              <Button type="submit" disabled={loading || (!isForgot && !tokenReady)} className="group relative mt-1 h-12 w-full justify-between rounded-none bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#101210] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_12px_35px_rgba(255,255,255,0.08)] disabled:translate-y-0">
                <span>{loading ? (isForgot ? "Sending…" : "Resetting…") : (isForgot ? "Send reset link" : "Reset password")}</span>
                {!loading ? <ArrowDownRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5" /> : null}
              </Button>
              <Link href="/login" className="self-center py-1 text-xs text-white/55 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">Back to Sign In</Link>
            </form>
          )}

          <div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.13em] text-white/35"><ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" /><span>Protected by CloudGuard security principles</span></div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes cg-auth-enter { from { opacity: 0; transform: translate3d(0, 14px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
        @keyframes cg-auth-orbit { from { transform: rotate(0deg) scale(1); } to { transform: rotate(360deg) scale(1.04); } }
        .cg-auth-enter { animation: cg-auth-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .cg-auth-orbit { animation: cg-auth-orbit 48s linear infinite; }
        .cg-auth-orbit-reverse { animation: cg-auth-orbit 62s linear infinite reverse; }
        @media (prefers-reduced-motion: reduce) { .cg-auth-enter, .cg-auth-orbit, .cg-auth-orbit-reverse { animation: none !important; } }
      `}</style>
    </main>
  );
}
