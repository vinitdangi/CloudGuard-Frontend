"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiErrorMessage } from "@/lib/api/client";
import { login, signup } from "@/lib/api/auth";
import { ArrowDownRight, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { AsciiScene } from "@/components/landing/ascii-scene";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "signup";
type FormValues = {
  fullName: string;
  username: string;
  email: string;
  identifier: string;
  password: string;
  confirmPassword: string;
};
type FormErrors = Partial<Record<keyof FormValues, string>>;
type Feedback = { kind: "error" | "success" | "info"; message: string } | null;

const initialValues: FormValues = {
  fullName: "",
  username: "",
  email: "",
  identifier: "",
  password: "",
  confirmPassword: "",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validate(mode: AuthMode, values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (mode === "login") {
    if (!values.identifier.trim()) errors.identifier = "Enter your email or username.";
    if (!values.password) errors.password = "Enter your password.";
    return errors;
  }

  if (values.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!/^[a-zA-Z0-9_-]{3,24}$/.test(values.username.trim())) {
    errors.username = "Use 3–24 letters, numbers, underscores, or hyphens.";
  }
  if (!isValidEmail(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Use at least 8 characters.";
  if (!values.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Your passwords do not match.";
  }

  return errors;
}

function AuthField({
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

function AuthPasswordField({
  id,
  label,
  value,
  error,
  visible,
  onToggle,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <AuthField id={id} label={label} error={error}>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 pr-12 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-white/45 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
    </AuthField>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(() => {
    const password = values.password;
    if (!password) return 0;
    return [
      password.length >= 8,
      /[a-z]/.test(password) && /[A-Z]/.test(password),
      /\d/.test(password),
      /[^a-zA-Z0-9]/.test(password),
    ].filter(Boolean).length;
  }, [values.password]);

  const updateValue = (key: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setFeedback(null);
    const nextErrors = validate(mode, values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const response = isLogin
        ? await login({
            identifier: values.identifier.trim(),
            password: values.password,
            rememberMe: remember,
          })
        : await signup({
            fullName: values.fullName.trim(),
            username: values.username.trim(),
            email: values.email.trim(),
            password: values.password,
          });

      if (!response.authenticated) {
        setFeedback({
          kind: "error",
          message: response.message ?? "The CloudGuard API did not establish an authenticated session.",
        });
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setFeedback({
        kind: "error",
        message: apiErrorMessage(error, "CloudGuard authentication could not be completed."),
      });
    } finally {
      setLoading(false);
    }
  };

  const statusTone = feedback?.kind === "success"
    ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100"
    : feedback?.kind === "error"
      ? "border-rose-300/25 bg-rose-300/[0.07] text-rose-100"
      : "border-white/15 bg-white/[0.04] text-white/70";

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
        <div className="flex items-center gap-2 text-right text-xs sm:gap-4 sm:text-sm">
          <span className="hidden text-white/45 sm:inline">{isLogin ? "New to CloudGuard?" : "Already have access?"}</span>
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="group inline-flex items-center gap-1.5 py-2 font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {isLogin ? "Create Account" : "Sign In"}
            <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-8 px-5 pb-6 sm:px-8 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.78fr)] lg:gap-16 lg:px-12 lg:pb-14">
        <section aria-label="CloudGuard security" className="relative hidden min-h-[560px] flex-col justify-between overflow-hidden py-8 lg:flex">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.23] [mask-image:radial-gradient(ellipse_at_48%_44%,black_5%,transparent_70%)]">
            <AsciiScene />
          </div>
          <div className="relative z-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
            <span className="size-1.5 rounded-full bg-emerald-200/80 shadow-[0_0_14px_rgba(167,243,208,0.8)]" />
            Secure access · AWS control plane
          </div>
          <div className="relative z-10 max-w-[580px] py-10">
            <p className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              <span className="h-px w-9 bg-white/30" />
              Clarity at every layer
            </p>
            <h1 className="max-w-[560px] font-display text-[clamp(3.8rem,7vw,7.2rem)] leading-[0.92] tracking-[-0.055em] text-white">
              See what gets in.
            </h1>
            <p className="mt-7 max-w-[390px] text-sm leading-7 text-white/55">
              A clearer view of your AWS security posture starts with a more secure way in.
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            <span>Identity · Access · Assurance</span>
            <span>CG / 01</span>
          </div>
        </section>

        <section aria-labelledby="auth-title" className="cg-auth-enter mx-auto w-full max-w-[470px] py-3 lg:py-8">
          <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 sm:mb-8 lg:hidden">
            <span className="size-1.5 rounded-full bg-emerald-200/80 shadow-[0_0_14px_rgba(167,243,208,0.8)]" />
            Secure access · AWS control plane
          </div>
          <div className="mb-6 sm:mb-8">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              <LockKeyhole aria-hidden="true" className="size-3.5" />
              {isLogin ? "Returning operator" : "New operator access"}
            </div>
            <h2 id="auth-title" className="font-display text-4xl leading-[1.05] tracking-tight sm:text-[2.7rem]">
              {isLogin ? "Sign in to your workspace" : "Create your account"}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
              {isLogin
                ? "Enter your credentials to continue to CloudGuard."
                : "Set up your CloudGuard identity and secure access."}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="flex flex-col gap-4 sm:gap-5">
            <FieldGroup className="gap-3 sm:gap-4">
              {isLogin ? (
                <AuthField id="identifier" label="Email or username" error={errors.identifier}>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    value={values.identifier}
                    onChange={(event) => updateValue("identifier", event.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={errors.identifier ? "identifier-error" : undefined}
                    className="h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70"
                    placeholder="name@company.com"
                  />
                </AuthField>
              ) : (
                <>
                  <AuthField id="fullName" label="Full name" error={errors.fullName}>
                    <Input
                      id="fullName"
                      name="name"
                      type="text"
                      value={values.fullName}
                      onChange={(event) => updateValue("fullName", event.target.value)}
                      autoComplete="name"
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={errors.fullName ? "fullName-error" : undefined}
                      className="h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70"
                      placeholder="Your name"
                    />
                  </AuthField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AuthField id="username" label="Username" error={errors.username}>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        value={values.username}
                        onChange={(event) => updateValue("username", event.target.value)}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={Boolean(errors.username)}
                        aria-describedby={errors.username ? "username-error" : undefined}
                        className="h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70"
                        placeholder="cloud_operator"
                      />
                    </AuthField>
                    <AuthField id="email" label="Email" error={errors.email}>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={values.email}
                        onChange={(event) => updateValue("email", event.target.value)}
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "email-error" : undefined}
                        className="h-11 sm:h-12 rounded-none border-white/15 bg-white/[0.035] px-4 text-sm text-white shadow-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/25 hover:border-white/30 focus-visible:border-white/65 focus-visible:bg-white/[0.06] focus-visible:ring-0 aria-invalid:border-rose-300/70"
                        placeholder="you@company.com"
                      />
                    </AuthField>
                  </div>
                </>
              )}

              <AuthPasswordField
                id="password"
                label="Password"
                value={values.password}
                error={errors.password}
                visible={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
                onChange={(value) => updateValue("password", value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />

              {!isLogin && (
                <>
                  <div aria-live="polite" className="-mt-1 flex items-center gap-2" aria-label={`Password strength: ${["", "Weak", "Fair", "Good", "Strong"][passwordStrength]}`}>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">Strength</span>
                    <div className="flex flex-1 gap-1" aria-hidden="true">
                      {[1, 2, 3, 4].map((segment) => (
                        <span
                          key={segment}
                          className={`h-px flex-1 transition-colors duration-300 ${passwordStrength >= segment ? (passwordStrength < 2 ? "bg-rose-300/80" : passwordStrength < 4 ? "bg-amber-200/80" : "bg-emerald-200/80") : "bg-white/15"}`}
                        />
                      ))}
                    </div>
                    <span className="min-w-10 text-right font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                      {["—", "Weak", "Fair", "Good", "Strong"][passwordStrength]}
                    </span>
                  </div>
                  <AuthPasswordField
                    id="confirmPassword"
                    label="Confirm password"
                    value={values.confirmPassword}
                    error={errors.confirmPassword}
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((visible) => !visible)}
                    onChange={(value) => updateValue("confirmPassword", value)}
                    autoComplete="new-password"
                  />
                </>
              )}
            </FieldGroup>

            {isLogin ? (
              <div className="flex items-center justify-between gap-3">
                <Field orientation="horizontal" className="w-auto items-center gap-2.5">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                    className="size-4 rounded-none border-white/30 bg-white/[0.04] data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                  <Label htmlFor="remember" className="cursor-pointer text-xs font-normal text-white/55">Remember me</Label>
                </Field>
                <button
                  type="button"
                  onClick={() => setFeedback({ kind: "info", message: "Password reset is not connected yet. No request was sent." })}
                  className="text-xs text-white/55 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-[11px] leading-5 text-white/40">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-100/70" />
                Use at least 8 characters. Sign-in details go only to the configured CloudGuard API.
              </p>
            )}

            {feedback ? (
              <div role={feedback.kind === "success" ? "status" : "alert"} aria-live="polite" className={`border px-3.5 py-3 text-xs leading-5 ${statusTone}`}>
                {feedback.message}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="group relative mt-1 h-12 w-full justify-between rounded-none bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#101210] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_12px_35px_rgba(255,255,255,0.08)] disabled:translate-y-0"
            >
              <span className="inline-flex items-center gap-2">
                {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                {loading ? "Connecting…" : isLogin ? "Sign In" : "Create Account"}
              </span>
              {!loading ? <ArrowDownRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5" /> : <span aria-hidden="true" className="size-4" />}
            </Button>
          </form>

          <div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.13em] text-white/35">
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Protected by CloudGuard security principles</span>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes cg-auth-enter {
          from { opacity: 0; transform: translate3d(0, 14px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes cg-auth-orbit {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1.04); }
        }
        .cg-auth-enter { animation: cg-auth-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .cg-auth-orbit { animation: cg-auth-orbit 48s linear infinite; }
        .cg-auth-orbit-reverse { animation: cg-auth-orbit 62s linear infinite reverse; }
        @media (prefers-reduced-motion: reduce) {
          .cg-auth-enter, .cg-auth-orbit, .cg-auth-orbit-reverse { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

export default AuthPage;
