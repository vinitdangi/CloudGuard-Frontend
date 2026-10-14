"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleHelp,
  Cloud,
  Fingerprint,
  Globe2,
  HardDrive,
  LockKeyhole,
  Network,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { AsciiScene } from "@/components/landing/ascii-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IMPLEMENTED_AWS_CHECKS } from "@/lib/dashboard-data";

const regions = [
  ["us-east-1", "US East (N. Virginia)"],
  ["us-east-2", "US East (Ohio)"],
  ["us-west-1", "US West (N. California)"],
  ["us-west-2", "US West (Oregon)"],
  ["ca-central-1", "Canada (Central)"],
  ["eu-west-1", "Europe (Ireland)"],
  ["eu-central-1", "Europe (Frankfurt)"],
  ["eu-west-2", "Europe (London)"],
  ["ap-southeast-1", "Asia Pacific (Singapore)"],
  ["ap-southeast-2", "Asia Pacific (Sydney)"],
  ["ap-northeast-1", "Asia Pacific (Tokyo)"],
] as const;

const scanStages = [
  { label: "AWS Account", icon: Cloud },
  { label: "IAM", icon: Fingerprint },
  { label: "S3", icon: HardDrive },
  { label: "Security Groups", icon: Network },
  { label: "Network ACLs", icon: Globe2 },
  { label: "CloudTrail", icon: Activity },
  { label: "Risk Assessment", icon: ShieldAlert },
  { label: "Security Score", icon: ShieldCheck },
] as const;

const checkIcons = [Fingerprint, HardDrive, Network, Globe2, Activity] as const;
const checkLabels: Record<(typeof IMPLEMENTED_AWS_CHECKS)[number]["name"], string> = {
  IAM: "AWS IAM",
  S3: "Amazon S3",
  "Security Groups": "Security Groups",
  "Network ACLs": "Network ACLs",
  CloudTrail: "AWS CloudTrail",
};

const resultMetrics = [
  { label: "Critical findings", shortLabel: "Critical", color: "text-rose-100/75" },
  { label: "High findings", shortLabel: "High", color: "text-orange-100/75" },
  { label: "Medium findings", shortLabel: "Medium", color: "text-amber-100/75" },
  { label: "Low findings", shortLabel: "Low", color: "text-sky-100/75" },
  { label: "Passed checks", shortLabel: "Passed", color: "text-emerald-100/75" },
  { label: "Total findings", shortLabel: "Total", color: "text-white/65" },
] as const;

type ConnectionState = "idle" | "testing" | "connected-preview" | "failed";
type ScanState = "idle" | "preparing" | "scanning" | "completed" | "error";

function CloudGuardMark() {
  return (
    <Link href="/" aria-label="CloudGuard home" className="group inline-flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
      <span className="flex size-9 shrink-0 items-center justify-center border border-white/15 bg-white/[0.035] text-emerald-100/80 transition-colors group-hover:border-white/30">
        <ShieldCheck aria-hidden="true" className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[1.45rem] leading-none tracking-tight text-white">CloudGuard</span>
        <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">AWS security console</span>
      </span>
    </Link>
  );
}

function StateBadge({ state }: { state: ConnectionState }) {
  const isPreviewConnected = state === "connected-preview";
  const isPending = state === "testing";
  const label = isPreviewConnected
    ? "Preview only · success"
    : isPending
      ? "Preview · checking"
      : state === "failed"
        ? "Preview · unavailable"
        : "AWS not connected";

  return (
    <Badge
      variant="outline"
      role="status"
      aria-live="polite"
      className={`h-7 gap-2 rounded-none px-2.5 font-mono text-[8px] uppercase tracking-[0.1em] sm:text-[9px] ${
        isPreviewConnected
          ? "border-emerald-200/20 bg-emerald-100/[0.06] text-emerald-100/80"
          : isPending
            ? "border-sky-200/20 bg-sky-100/[0.05] text-sky-100/80"
            : "border-amber-200/20 bg-amber-100/[0.05] text-amber-100/80"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          isPreviewConnected
            ? "bg-emerald-200 shadow-[0_0_10px_rgba(167,243,208,0.7)]"
            : isPending
              ? "animate-pulse bg-sky-200"
              : "bg-amber-200/80"
        }`}
      />
      {label}
    </Badge>
  );
}

function MetricPreview({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0 border-t border-white/[0.08] px-3 py-3.5 sm:px-4">
      <p className={`truncate font-mono text-[8px] uppercase tracking-[0.12em] ${accent ?? "text-white/35"}`}>{label}</p>
      <p className="mt-2 font-display text-2xl leading-none text-white sm:text-[1.7rem]">{value}</p>
    </div>
  );
}

export function SecurityScanConsole() {
  const [region, setRegion] = useState("us-east-1");
  const [useEnvironmentCredentials, setUseEnvironmentCredentials] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [isPreviewingScan, setIsPreviewingScan] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  useEffect(() => {
    if (connectionState !== "testing") return;

    const timer = window.setTimeout(() => {
      setConnectionState("failed");
      setConnectionMessage("No connection request was sent. The CloudGuard API is not connected to this preview.");
    }, 850);

    return () => window.clearTimeout(timer);
  }, [connectionState]);

  useEffect(() => {
    if (!isPreviewingScan) return;

    const timer = window.setTimeout(() => {
      if (scanState === "preparing") {
        setScanState("scanning");
        return;
      }

      if (scanStageIndex >= scanStages.length - 1) {
        setScanState("completed");
        setIsPreviewingScan(false);
        setScanMessage("Preview complete. No AWS resources were queried and no scan results were created.");
        return;
      }

      setScanStageIndex((current) => current + 1);
    }, scanState === "preparing" ? 850 : 1050);

    return () => window.clearTimeout(timer);
  }, [isPreviewingScan, scanStageIndex, scanState]);

  const previewConnection = (previewState: "connected-preview" | "failed") => {
    setConnectionState(previewState);
    setConnectionMessage(
      previewState === "connected-preview"
        ? "Preview state only. No AWS account was contacted or verified."
        : "Preview state only. No AWS connection request was sent."
    );
  };

  const testConnection = () => {
    setConnectionMessage("Checking the local interface state. No credentials will be transmitted.");
    setConnectionState("testing");
  };

  const runSecurityScan = () => {
    setIsPreviewingScan(false);
    setScanState("error");
    setScanMessage("Scan not started. Frontend-to-backend integration is not connected; no AWS request was made.");
  };

  const startScanPreview = () => {
    setScanStageIndex(0);
    setScanMessage("");
    setScanState("preparing");
    setIsPreviewingScan(true);
  };

  const progress = scanState === "completed"
    ? 100
    : isPreviewingScan
      ? Math.round(((scanStageIndex + (scanState === "scanning" ? 0.55 : 0)) / scanStages.length) * 100)
      : 0;
  const currentStage = scanStages[scanStageIndex];
  const scannedServiceCount = Math.min(Math.max(scanStageIndex, 0), 5);
  const statusLabel = scanState === "preparing"
    ? "Preparing preview"
    : scanState === "scanning"
      ? "Scanning preview"
      : scanState === "completed"
        ? "Preview complete · no AWS scan"
        : scanState === "error"
          ? "Backend not connected"
          : "Ready · preview only";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#080a09] text-white selection:bg-[#eca8d6]/30">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_0%,rgba(67,110,89,0.13),transparent_38%),radial-gradient(ellipse_at_12%_88%,rgba(236,168,214,0.035),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:76px_76px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080a09]/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-10 max-w-[1380px] items-center justify-between gap-3">
          <CloudGuardMark />
          <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/dashboard" className="hidden min-h-9 items-center px-2 text-[10px] text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex">Dashboard</Link>
            <Button asChild size="sm" className="h-9 rounded-none bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.09em] text-[#101210] hover:bg-white/90 sm:px-4 sm:text-[10px]">
              <Link href="/"><ArrowDownRight data-icon="inline-start" />Back to site</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="cg-scan-enter relative z-10 mx-auto w-full max-w-[1380px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-10 xl:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-7 gap-2 rounded-none border-amber-100/15 bg-amber-100/[0.035] px-2.5 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-50/60 sm:text-[9px]">
              <CircleHelp aria-hidden="true" className="size-3" />UI preview · no backend calls
            </Badge>
            <Badge variant="outline" className="h-7 gap-2 rounded-none border-white/[0.09] bg-white/[0.02] px-2.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/50 sm:text-[9px]">
              <Globe2 aria-hidden="true" className="size-3" />{region}
            </Badge>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/30 sm:text-[9px]">Control plane <span className="text-white/15">·</span> AWS</span>
        </div>

        <section aria-labelledby="scan-page-title" className="mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.21em] text-white/40">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-100/70 shadow-[0_0_12px_rgba(167,243,208,0.55)]" />
              CloudGuard / Assessment control
            </p>
            <h1 id="scan-page-title" className="font-display text-[clamp(2.5rem,6vw,4.2rem)] leading-[0.95] tracking-[-0.05em] text-white">Security <span className="text-white/45">Scan</span></h1>
            <p className="mt-3 max-w-2xl text-[11px] leading-5 text-white/45 sm:text-[12px]">Configure a target region and explore the scan interface. Live AWS access is not connected in this UI preview.</p>
          </div>
          <StateBadge state={connectionState} />
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <Card id="aws-configuration" className="scroll-mt-24 gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">01 / AWS configuration</p>
              <CardTitle className="mt-2 font-display text-[1.55rem] font-normal tracking-tight text-white">Connection details</CardTitle>
              <CardDescription className="max-w-lg text-[10px] leading-5 text-white/40">Choose the target region and review how credential setup will work when the CloudGuard API is connected.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="scan-aws-region" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">AWS Region</FieldLabel>
                  <select
                    id="scan-aws-region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    className="h-10 w-full min-w-0 border border-white/[0.12] bg-[#0b0e0d] px-3 font-mono text-[11px] text-white/80 outline-none transition-colors focus-visible:border-emerald-100/50 focus-visible:ring-2 focus-visible:ring-emerald-100/15"
                  >
                    {regions.map(([value, label]) => <option key={value} value={value} className="bg-[#0b0e0d] text-white">{label} · {value}</option>)}
                  </select>
                </Field>

                <label htmlFor="scan-env-credentials" className="flex min-h-12 cursor-pointer items-start gap-3 border border-white/[0.09] bg-white/[0.02] px-3 py-3 transition-colors hover:border-white/15">
                  <input
                    id="scan-env-credentials"
                    type="checkbox"
                    checked={useEnvironmentCredentials}
                    onChange={(event) => setUseEnvironmentCredentials(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100/40"
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] text-white/75">Use existing AWS environment credentials</span>
                    <span className="mt-1 block text-[9px] leading-4 text-white/35">Preview only. This page cannot read server-side credentials.</span>
                  </span>
                </label>

                {!useEnvironmentCredentials ? (
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="scan-access-key" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">Access Key ID</FieldLabel>
                      <Input id="scan-access-key" type="text" autoComplete="off" spellCheck={false} placeholder="Enter Access Key ID" className="h-10 min-w-0 rounded-none border-white/[0.12] bg-black/20 px-3 font-mono text-[11px] text-white placeholder:text-white/25 focus-visible:border-emerald-100/40 focus-visible:ring-emerald-100/10" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="scan-secret-key" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">Secret Access Key</FieldLabel>
                      <Input id="scan-secret-key" type="password" autoComplete="new-password" spellCheck={false} placeholder="Enter Secret Access Key" className="h-10 min-w-0 rounded-none border-white/[0.12] bg-black/20 px-3 font-mono text-[11px] text-white placeholder:text-white/25 focus-visible:border-emerald-100/40 focus-visible:ring-emerald-100/10" />
                    </Field>
                  </div>
                ) : null}
              </FieldGroup>

              <div className="mt-5 flex items-start gap-3 border border-emerald-100/10 bg-emerald-100/[0.025] px-3.5 py-3">
                <LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-100/65" />
                <p className="text-[9px] leading-4 text-white/45">Security notice: credentials are used only for AWS scanning through the CloudGuard backend. This preview does not read, send, or store key values.</p>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.08] pt-4">
                <Button type="button" variant="outline" onClick={testConnection} disabled={connectionState === "testing"} className="h-10 w-full rounded-none border-white/15 bg-white/[0.035] px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-white/[0.08] sm:w-auto sm:self-end">
                  <Cloud data-icon="inline-start" className={connectionState === "testing" ? "animate-pulse" : undefined} />
                  {connectionState === "testing" ? "Previewing connection…" : "Test AWS Connection"}
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">Connection UI states · preview only</span>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => previewConnection("connected-preview")} className="h-8 rounded-none px-2 text-[8px] uppercase tracking-[0.08em] text-emerald-100/60 hover:bg-emerald-100/[0.05] hover:text-emerald-50">Preview success</Button>
                    <Button type="button" variant="ghost" onClick={() => previewConnection("failed")} className="h-8 rounded-none px-2 text-[8px] uppercase tracking-[0.08em] text-white/45 hover:bg-white/[0.05] hover:text-white/75">Preview failure</Button>
                  </div>
                </div>
              </div>

              {connectionState === "connected-preview" ? (
                <div role="status" className="mt-3 flex items-start gap-3 border border-emerald-200/15 bg-emerald-100/[0.035] px-3.5 py-3">
                  <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-100/75" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-emerald-50/85">Success-state preview only</p>
                    <p className="mt-1 text-[9px] leading-4 text-white/45">Account ID: — <span className="text-white/25">·</span> Region: {region}</p>
                    <p className="mt-1 text-[9px] leading-4 text-white/35">No account was connected or verified.</p>
                  </div>
                </div>
              ) : null}
              {connectionState === "failed" && connectionMessage ? (
                <div role="alert" className="mt-3 flex items-start gap-3 border border-rose-200/10 bg-rose-100/[0.025] px-3.5 py-3">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-100/65" />
                  <p className="text-[9px] leading-4 text-white/55">{connectionMessage}</p>
                </div>
              ) : null}
              {connectionState === "idle" ? (
                <p className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-white/35">
                  <CircleHelp aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Connection testing is a UI placeholder until the existing backend is connected.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card className="relative isolate min-h-[360px] overflow-hidden gap-0 rounded-none border-white/[0.09] bg-[#0c100e] py-0 shadow-none sm:min-h-[390px]">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.3] [mask-image:radial-gradient(ellipse_at_76%_40%,black_3%,transparent_68%)]"><AsciiScene /></div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_42%,rgba(87,143,111,0.12),transparent_52%)]" />
              <CardHeader className="relative z-10 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">02 / Assessment control</p>
                    <CardTitle className="mt-2 font-display text-[1.65rem] font-normal tracking-tight text-white">{scanState === "completed" ? "Preview complete" : scanState === "error" ? "Scan unavailable" : scanState === "scanning" ? "Scanning AWS environment" : scanState === "preparing" ? "Preparing scan preview" : "Ready to scan"}</CardTitle>
                    <CardDescription className="mt-1 max-w-md text-[10px] leading-5 text-white/40">{isPreviewingScan ? "A local animation preview is moving through the implemented check stages." : "Run the primary action to see the backend-not-connected state, or preview the scan animation."}</CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-none border-white/[0.1] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/50">{statusLabel}</Badge>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/40">{isPreviewingScan ? `Current stage · ${currentStage.label}` : "Scan pipeline · UI preview"}</span>
                  <span className="shrink-0 font-mono text-[8px] text-white/40">{progress}%</span>
                </div>
                <div role="progressbar" aria-label="Simulated scan preview progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={isPreviewingScan ? `${currentStage.label}, simulated preview only` : statusLabel} className="relative h-1 overflow-hidden bg-white/[0.09]">
                  <div className={`h-full bg-emerald-100/70 transition-[width] duration-700 ${scanState === "error" ? "bg-rose-100/50" : ""}`} style={{ width: `${progress}%` }} />
                  {isPreviewingScan ? <span aria-hidden="true" className="cg-scan-sweep absolute inset-y-0 left-0 w-1/3 bg-emerald-100/70 shadow-[0_0_12px_rgba(167,243,208,0.45)]" /> : null}
                </div>

                <ol aria-label="Scan stages" className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                  {scanStages.map(({ label, icon: Icon }, index) => {
                    const completed = scanState === "completed" || (isPreviewingScan && index < scanStageIndex);
                    const current = isPreviewingScan && index === scanStageIndex;
                    return (
                      <li key={label} aria-current={current ? "step" : undefined} className={`flex min-w-0 items-center gap-2 border px-2.5 py-2 transition-colors duration-300 ${current ? "border-emerald-100/25 bg-emerald-100/[0.055] text-emerald-50/90" : completed ? "border-white/[0.09] bg-white/[0.025] text-white/65" : "border-white/[0.06] bg-black/10 text-white/35"}`}>
                        <span className={`flex size-5 shrink-0 items-center justify-center ${current ? "text-emerald-100/80" : completed ? "text-emerald-100/60" : "text-white/30"}`}>
                          {completed ? <Check aria-hidden="true" className="size-3" /> : <Icon aria-hidden="true" className={`size-3 ${current && isPreviewingScan ? "cg-stage-pulse" : ""}`} />}
                        </span>
                        <span className="min-w-0 truncate text-[9px]">{label}</span>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 grid grid-cols-3 border-y border-white/[0.08]">
                  <div className="min-w-0 py-3 pr-2">
                    <p className="truncate font-mono text-[7px] uppercase tracking-[0.12em] text-white/30 sm:text-[8px]">Current service</p>
                    <p className="mt-1.5 truncate text-[10px] text-white/70">{isPreviewingScan ? currentStage.label : "—"}</p>
                  </div>
                  <div className="min-w-0 border-x border-white/[0.08] px-2 py-3">
                    <p className="truncate font-mono text-[7px] uppercase tracking-[0.12em] text-white/30 sm:text-[8px]">Services scanned</p>
                    <p className="mt-1.5 text-[10px] text-white/70">{isPreviewingScan || scanState === "completed" ? `${scannedServiceCount} / 5 · preview` : "—"}</p>
                  </div>
                  <div className="min-w-0 py-3 pl-2">
                    <p className="truncate font-mono text-[7px] uppercase tracking-[0.12em] text-white/30 sm:text-[8px]">Findings</p>
                    <p className="mt-1.5 text-[10px] text-white/70">—</p>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-5">
                  <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-sm text-[9px] leading-4 text-white/35">No AWS resources are accessed by either action in this preview.</p>
                    <Button type="button" onClick={runSecurityScan} disabled={isPreviewingScan} className="h-10 w-full shrink-0 rounded-none bg-white px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#101210] transition-transform hover:-translate-y-0.5 hover:bg-white/90 sm:w-auto">
                      <ScanLine data-icon="inline-start" className={isPreviewingScan ? "motion-safe:animate-spin" : undefined} />Run Security Scan
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/30">Animation preview · simulated only</span>
                    <Button type="button" variant="outline" onClick={startScanPreview} disabled={isPreviewingScan} className="h-8 rounded-none border-white/15 bg-white/[0.025] px-3 text-[8px] font-semibold uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.08] hover:text-white">
                      <Activity data-icon="inline-start" />{scanState === "completed" ? "Replay preview" : isPreviewingScan ? "Preview in progress…" : "Preview scan animation"}
                    </Button>
                  </div>
                </div>

                {scanMessage ? (
                  <p role={scanState === "error" ? "alert" : "status"} aria-live={scanState === "error" ? "assertive" : "polite"} className={`mt-3 border px-3 py-2 text-[9px] leading-4 ${scanState === "error" ? "border-rose-200/10 bg-rose-100/[0.025] text-rose-50/70" : "border-amber-200/10 bg-amber-100/[0.025] text-amber-50/65"}`}>{scanMessage}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
              <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">Scan scope</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="font-display text-[1.35rem] font-normal tracking-tight text-white">Supported security checks</CardTitle>
                  <Badge variant="outline" className="shrink-0 rounded-none border-white/[0.1] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/50">{IMPLEMENTED_AWS_CHECKS.length} groups</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-px border-t border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
                {IMPLEMENTED_AWS_CHECKS.map((check, index) => {
                  const Icon = checkIcons[index];
                  return (
                    <div key={check.name} className="flex min-w-0 items-center gap-3 bg-[#0b0e0d] px-4 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.025] text-emerald-100/65"><Icon aria-hidden="true" className="size-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-medium text-white/75">{checkLabels[check.name]}</span>
                        <span className="mt-1 block truncate text-[9px] text-white/35">{check.detail}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[7px] uppercase tracking-[0.1em] text-white/30">In scope</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        <section aria-labelledby="scan-results-title" className="mt-4">
          <Card className="gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">03 / Results preview</p>
                  <CardTitle id="scan-results-title" className="mt-2 font-display text-[1.5rem] font-normal tracking-tight text-white">Security assessment summary</CardTitle>
                  <CardDescription className="mt-1 text-[10px] leading-5 text-white/40">{scanState === "completed" ? "Preview finished. Result values stay empty until a real scan is returned by CloudGuard." : "Results are not available until the connected CloudGuard backend completes a real scan."}</CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-none border-amber-100/15 bg-amber-100/[0.025] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-50/55">No scan data</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 border-t border-white/[0.08] sm:grid-cols-3 lg:grid-cols-7">
              <div className="border-t border-white/[0.08] px-3 py-3.5 sm:col-span-3 sm:border-t-0 sm:px-4 lg:col-span-1">
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-100/60">Security score</p>
                <p className="mt-2 font-display text-2xl leading-none text-white">— <span className="font-mono text-[9px] text-white/35">/ 100</span></p>
              </div>
              {resultMetrics.map(({ label, shortLabel, color }) => <MetricPreview key={label} label={label} value="—" accent={color} />)}
            </CardContent>
          </Card>
          <p className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-white/35">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Preview controls change interface states only. They do not contact AWS, generate findings, or calculate a Security Score.
          </p>
        </section>
      </div>

      <style jsx global>{`
        @keyframes cg-scan-enter {
          from { opacity: 0; transform: translate3d(0, 10px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes cg-scan-sweep {
          from { transform: translateX(-110%); }
          to { transform: translateX(340%); }
        }
        @keyframes cg-scan-stage-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .cg-scan-enter { animation: cg-scan-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .cg-scan-sweep { animation: cg-scan-sweep 1.8s ease-in-out infinite; }
        .cg-stage-pulse { animation: cg-scan-stage-pulse 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cg-scan-enter, .cg-scan-sweep, .cg-stage-pulse { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

export default SecurityScanConsole;
