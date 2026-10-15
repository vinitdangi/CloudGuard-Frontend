"use client";

import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  Cloud,
  CloudCog,
  Download,
  Fingerprint,
  Globe2,
  HardDrive,
  LockKeyhole,
  Network,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { DashboardSnapshot, FindingSeverity } from "@/lib/dashboard-data";
import { IMPLEMENTED_AWS_CHECKS } from "@/lib/dashboard-data";
import { apiConfigurationMessage, apiErrorMessage, isApiEndpointConfigured } from "@/lib/api/client";
import { testAwsConnection } from "@/lib/api/aws";
import { buildAwsScanRequest } from "@/lib/api/aws-request.mjs";
import { DASHBOARD_DATA_KEY, dashboardDataWithScan, runSecurityScan, type DashboardDataResult } from "@/lib/api/scans";
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
import type { ReportFormat } from "@/lib/api/types";

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

const checkIcons = [Fingerprint, HardDrive, Network, Globe2, Activity] as const;

type ConnectionState = "not-connected" | "testing" | "connected" | "failed";
type FindingSeverityCount = Record<FindingSeverity, number>;

function StatusBadge({ state }: { state: ConnectionState }) {
  const labels: Record<ConnectionState, string> = {
    "not-connected": "Not connected",
    testing: "Testing connection",
    connected: "Connected to AWS",
    failed: "Connection failed",
  };
  const connected = state === "connected";
  const pending = state === "testing";

  return (
    <Badge
      variant="outline"
      className={`h-7 gap-2 rounded-none px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
        connected
          ? "border-emerald-200/20 bg-emerald-100/[0.06] text-emerald-100/80"
          : pending
            ? "border-sky-200/20 bg-sky-100/[0.05] text-sky-100/80"
            : "border-amber-200/20 bg-amber-100/[0.05] text-amber-100/80"
      }`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          connected
            ? "bg-emerald-200 shadow-[0_0_10px_rgba(167,243,208,0.7)]"
            : pending
              ? "animate-pulse bg-sky-200"
              : "bg-amber-200/80"
        }`}
      />
      {labels[state]}
    </Badge>
  );
}

function SummaryValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-t border-white/[0.08] px-4 py-3 first:border-t-0 sm:first:border-t">
      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 font-display text-2xl leading-none text-white">{value}</p>
    </div>
  );
}

export function SecurityScanSection({
  snapshot,
  onReportDownload,
  reportLoading,
  reportMessage,
  onConnectionVerificationChange,
}: {
  snapshot: DashboardSnapshot;
  onConnectionVerificationChange: (verified: boolean) => void;
  onReportDownload: (format: ReportFormat) => Promise<void>;
  reportLoading: ReportFormat | null;
  reportMessage: { kind: "error" | "success"; message: string } | null;
}) {
  const { mutate } = useSWRConfig();
  const [localConnectionState, setLocalConnectionState] = useState<"testing" | "connected" | "failed" | null>(null);
  const connectionState: ConnectionState = localConnectionState ?? "not-connected";
  const [region, setRegion] = useState(snapshot.region ?? "us-east-1");
  const [useEnvironmentCredentials, setUseEnvironmentCredentials] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [connectionAccount, setConnectionAccount] = useState<string | null>(null);
  const [connectionRegion, setConnectionRegion] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<Awaited<ReturnType<typeof runSecurityScan>> | null>(null);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const clearCredentialFields = () => {
    setAccessKeyId("");
    setSecretAccessKey("");
  };

  useEffect(() => {
    if (snapshot.region) setRegion(snapshot.region);
  }, [snapshot.region]);

  const latestScanStatus = scanResult?.scan.status ?? snapshot.scans[0]?.status;
  const scanCompleted = latestScanStatus === "Completed";
  const scanInProgress = scanLoading;
  const scanFailed = latestScanStatus === "Failed";
  const summary = scanResult?.summary ?? snapshot.summary;
  const score = scanResult?.score ?? snapshot.score;
  const hasBackendSummary = scanResult !== null || (scanCompleted && summary !== null);
  const severityCounts: FindingSeverityCount | null = scanResult?.severityCounts ?? snapshot.severityCounts;

  const testConnection = async () => {
    setConnectionMessage("");
    onConnectionVerificationChange(false);
    if (!isApiEndpointConfigured("testAwsConnection")) {
      setLocalConnectionState("failed");
      setConnectionMessage(apiConfigurationMessage("testAwsConnection") ?? "AWS connection endpoint is not configured.");
      return;
    }

    const credentials = useEnvironmentCredentials
      ? undefined
      : {
          accessKeyId: accessKeyId.trim(),
          secretAccessKey,
        };
    if (credentials && (!credentials.accessKeyId || !credentials.secretAccessKey)) {
      setLocalConnectionState("failed");
      setConnectionMessage("Enter both AWS keys or select existing backend environment credentials.");
      return;
    }

    setLocalConnectionState("testing");
    try {
      const response = await testAwsConnection({
        auth_method: useEnvironmentCredentials
          ? "Existing AWS Environment Credentials"
          : "Access Key",
        region,
        ...(credentials
          ? {
              access_key_id: credentials.accessKeyId,
              secret_access_key: credentials.secretAccessKey,
            }
          : {}),
      });
      setLocalConnectionState(response.connected ? "connected" : "failed");
      onConnectionVerificationChange(response.connected);
      setConnectionAccount(response.account_id);
      setConnectionRegion(response.region);
      setConnectionMessage(response.message ?? (response.connected ? "AWS connection verified by CloudGuard." : "AWS connection was not verified."));
      if (response.connected) await mutate(DASHBOARD_DATA_KEY);
    } catch (error) {
      setLocalConnectionState("failed");
      onConnectionVerificationChange(false);
      setConnectionMessage(apiErrorMessage(error, "AWS connection test failed."));
    }
  };

  const startSecurityScan = async () => {
    setScanMessage("");
    if (!isApiEndpointConfigured("runSecurityScan")) {
      setScanMessage(apiConfigurationMessage("runSecurityScan") ?? "Security scan endpoint is not configured.");
      return;
    }

    const credentials = useEnvironmentCredentials
      ? undefined
      : {
          accessKeyId: accessKeyId.trim(),
          secretAccessKey,
        };
    if (credentials && (!credentials.accessKeyId || !credentials.secretAccessKey)) {
      setScanMessage("Enter both AWS keys or select existing backend environment credentials.");
      return;
    }

    setScanLoading(true);
    try {
      const response = await runSecurityScan(buildAwsScanRequest({
        useEnvironmentCredentials,
        region,
        ...(credentials ? {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        } : {}),
      }));
      setScanResult(response);
      setScanMessage(`CloudGuard returned scan data with status: ${response.scan.status}.`);
      await mutate<DashboardDataResult>(
        DASHBOARD_DATA_KEY,
        (current) => dashboardDataWithScan(
          response,
          current ?? { snapshot, errors: [] },
        ),
        { revalidate: false },
      );
    } catch (error) {
      setScanMessage(apiErrorMessage(error, "The CloudGuard security scan failed."));
    } finally {
      setScanLoading(false);
      clearCredentialFields();
      setLocalConnectionState(null);
      onConnectionVerificationChange(false);
    }
  };

  return (
    <section id="security-scan" className="mt-10 scroll-mt-24 sm:mt-12" aria-labelledby="security-scan-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.21em] text-white/40">
            <span className="size-1.5 rounded-full bg-emerald-100/70 shadow-[0_0_12px_rgba(167,243,208,0.55)]" />
            CloudGuard / Assessment control
          </p>
          <h2 id="security-scan-title" className="font-display text-[clamp(2.2rem,4.5vw,3.5rem)] leading-[0.96] tracking-[-0.05em] text-white">
            Security Scan
          </h2>
          <p className="mt-3 max-w-2xl text-[12px] leading-5 text-white/45">
            Run a CloudGuard assessment against your AWS environment.
          </p>
        </div>
        <StatusBadge state={connectionState} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Card id="aws-configuration" className="scroll-mt-24 gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
          <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">AWS configuration</p>
            <CardTitle className="mt-2 font-display text-[1.55rem] font-normal tracking-tight text-white">Connection details</CardTitle>
            <CardDescription className="max-w-lg text-[10px] leading-5 text-white/40">
              Credentials stay in this page's memory and are sent only to the CloudGuard API for testing and scanning. They are not saved in browser storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="aws-region" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">
                  AWS Region
                </FieldLabel>
                <select
                  id="aws-region"
                  value={region}
                  onChange={(event) => {
                    setRegion(event.target.value);
                    setLocalConnectionState(null);
                    onConnectionVerificationChange(false);
                  }}
                  className="h-10 w-full min-w-0 border border-white/[0.12] bg-[#0b0e0d] px-3 font-mono text-[11px] text-white/80 outline-none transition-colors focus-visible:border-emerald-100/50 focus-visible:ring-2 focus-visible:ring-emerald-100/15"
                >
                  {regions.map(([value, label]) => (
                    <option key={value} value={value} className="bg-[#0b0e0d] text-white">
                      {label} · {value}
                    </option>
                  ))}
                </select>
              </Field>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 border border-white/[0.09] bg-white/[0.02] px-3">
                <input
                  type="checkbox"
                  checked={useEnvironmentCredentials}
                  onChange={(event) => {
                    setUseEnvironmentCredentials(event.target.checked);
                    setLocalConnectionState(null);
                    onConnectionVerificationChange(false);
                  }}
                  className="size-4 shrink-0 accent-emerald-200"
                />
                <span className="min-w-0">
                  <span className="block text-[10px] text-white/75">Use existing AWS environment credentials</span>
                  <span className="mt-1 block text-[9px] leading-4 text-white/35">Uses credentials already configured on the backend; this page does not access them.</span>
                </span>
              </label>

              {!useEnvironmentCredentials ? (
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="aws-access-key-id" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">
                      Access Key ID
                    </FieldLabel>
                    <Input
                      id="aws-access-key-id"
                      type="text"
                      value={accessKeyId}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Enter Access Key ID"
                      onChange={(event) => {
                        setAccessKeyId(event.target.value);
                        setLocalConnectionState(null);
                        onConnectionVerificationChange(false);
                      }}
                      className="h-10 rounded-none border-white/[0.12] bg-black/20 px-3 font-mono text-[11px] text-white placeholder:text-white/25 focus-visible:border-emerald-100/40 focus-visible:ring-emerald-100/10"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="aws-secret-access-key" className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/50">
                      Secret Access Key
                    </FieldLabel>
                    <Input
                      id="aws-secret-access-key"
                      type="password"
                      value={secretAccessKey}
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder="Enter Secret Access Key"
                      onChange={(event) => {
                        setSecretAccessKey(event.target.value);
                        setLocalConnectionState(null);
                        onConnectionVerificationChange(false);
                      }}
                      className="h-10 rounded-none border-white/[0.12] bg-black/20 px-3 font-mono text-[11px] text-white placeholder:text-white/25 focus-visible:border-emerald-100/40 focus-visible:ring-emerald-100/10"
                    />
                  </Field>
                </div>
              ) : null}
            </FieldGroup>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-sm text-[9px] leading-4 text-white/35">
                Credentials are sent only to the configured CloudGuard API; no AWS keys are persisted in browser storage.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={connectionState === "testing"}
                className="h-10 w-full shrink-0 rounded-none border-white/15 bg-white/[0.035] px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-white/[0.08] sm:w-auto"
              >
                <CloudCog data-icon="inline-start" />
                {connectionState === "testing" ? "Testing connection…" : "Test AWS Connection"}
              </Button>
            </div>

            {connectionState === "connected" ? (
              <div role="status" className="mt-4 flex items-start gap-3 border border-emerald-200/15 bg-emerald-100/[0.035] px-3.5 py-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-100/80" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-emerald-50/90">Connected to AWS</p>
                  <p className="mt-1 text-[9px] leading-4 text-white/40">
                    {connectionAccount
                      ? `Account ${connectionAccount}`
                      : "Account information not provided"}
                    {connectionRegion
                      ? ` · ${connectionRegion}`
                      : " · Region information not provided"}
                  </p>
                  {connectionMessage ? <p className="mt-1 text-[9px] leading-4 text-emerald-50/65">{connectionMessage}</p> : null}
                </div>
              </div>
            ) : null}

            {connectionState === "not-connected" ? (
              <div role="status" className="mt-4 flex items-start gap-3 border border-amber-200/10 bg-amber-100/[0.025] px-3.5 py-3">
                <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-100/55" />
                <div>
                  <p className="text-[10px] font-medium text-white/70">Not connected</p>
                  <p className="mt-1 text-[9px] leading-4 text-white/40">Run the connection test to verify AWS access for this session.</p>
                </div>
              </div>
            ) : null}

            {connectionState === "failed" && connectionMessage ? (
              <div role="alert" className="mt-4 flex items-start gap-3 border border-rose-200/10 bg-rose-100/[0.025] px-3.5 py-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-100/65" />
                <p className="text-[9px] leading-4 text-white/55">{connectionMessage}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="relative isolate min-h-[260px] overflow-hidden gap-0 rounded-none border-white/[0.09] bg-[#0c100e] py-0 shadow-none">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.35] [mask-image:radial-gradient(ellipse_at_76%_48%,black_3%,transparent_68%)]">
              <AsciiScene />
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_48%,rgba(87,143,111,0.12),transparent_52%)]" />
            <CardHeader className="relative z-10 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">Assessment control</p>
                  <CardTitle className="mt-2 font-display text-[1.6rem] font-normal tracking-tight text-white">{scanCompleted ? "Scan completed" : scanInProgress ? "Scanning AWS environment…" : scanFailed ? "Scan failed" : "Ready to scan"}</CardTitle>
                  <CardDescription className="mt-1 max-w-sm text-[10px] leading-5 text-white/40">
                    {scanCompleted ? `Latest completed scan · ${snapshot.lastScan ?? "time not provided"}` : scanInProgress ? "CloudGuard has reported an active assessment." : scanFailed ? "The latest scan was reported as failed by CloudGuard." : "Configure AWS access before running the implemented CloudGuard checks."}
                  </CardDescription>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center border border-white/[0.1] bg-white/[0.025] text-emerald-100/70">
                  {scanCompleted ? <Check aria-hidden="true" className="size-4" /> : <ScanLine aria-hidden="true" className="size-4" />}
                </span>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/40">Implemented check groups</span>
                <span className="font-mono text-[8px] text-white/40">{scanCompleted ? "5 / 5" : "0 / 5"}</span>
              </div>
              <div
                role="progressbar"
                aria-label="CloudGuard implemented checks"
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={scanCompleted ? 5 : scanInProgress ? undefined : 0}
                aria-valuetext={scanInProgress ? "CloudGuard scan in progress" : scanCompleted ? "All five implemented check groups completed" : "Scan not started"}
                className="relative h-1 overflow-hidden bg-white/[0.09]"
              >
                {scanCompleted ? <div className="h-full w-full bg-emerald-100/75" /> : null}
                {scanInProgress ? <span aria-hidden="true" className="cg-security-scan-progress absolute inset-y-0 left-0 w-1/3 bg-emerald-100/75 shadow-[0_0_12px_rgba(167,243,208,0.45)]" /> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {IMPLEMENTED_AWS_CHECKS.map((check) => (
                  <span key={check.name} className="flex min-w-0 items-center gap-2 text-[9px] text-white/50">
                    <span className={`size-1.5 shrink-0 rounded-full ${scanCompleted ? "bg-emerald-200/75" : "bg-white/20"}`} />
                    <span className="truncate">{check.name}</span>
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm text-[9px] leading-4 text-white/35">
                  {hasBackendSummary ? "Results below are from the connected CloudGuard backend." : "Uses only the configured CloudGuard API; no scan result is simulated."}
                </p>
                <Button
                  id="security-scan-run-button"
                  type="button"
                  onClick={startSecurityScan}
                  disabled={scanInProgress || connectionState !== "connected"}
                  className="h-10 w-full shrink-0 rounded-none bg-white px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#101210] hover:bg-white/90 sm:w-auto"
                >
                  <ScanLine data-icon="inline-start" className={scanInProgress ? "motion-safe:animate-spin" : undefined} />
                  {scanInProgress ? "Scanning AWS environment…" : "Run Security Scan"}
                </Button>
              </div>
              {connectionState !== "connected" && !scanMessage ? (
                <p role="status" className="mt-3 text-[9px] leading-4 text-white/45">
                  Enter both AWS keys or enable existing environment credentials, then test the connection before running a scan.
                </p>
              ) : null}
              {scanMessage ? (
                <p role="status" aria-live="polite" className="mt-3 border border-amber-200/10 bg-amber-100/[0.025] px-3 py-2 text-[9px] leading-4 text-amber-50/65">
                  {scanMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">Scan scope</p>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-display text-[1.35rem] font-normal tracking-tight text-white">What CloudGuard checks</CardTitle>
                <Badge variant="outline" className="shrink-0 rounded-none border-white/[0.1] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/50">5 groups</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-px border-t border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {IMPLEMENTED_AWS_CHECKS.map((check, index) => {
                const Icon = checkIcons[index];
                return (
                  <div key={check.name} className="flex min-w-0 items-center gap-3 bg-[#0b0e0d] px-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.025] text-emerald-100/65">
                      <Icon aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-medium text-white/75">{check.name}</span>
                      <span className="mt-1 block truncate text-[9px] text-white/35">{check.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[7px] uppercase tracking-[0.1em] text-white/30">{scanCompleted ? "Checked" : "In scope"}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {hasBackendSummary && summary ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <Card className="gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">Completed assessment</p>
              <CardTitle className="mt-2 font-display text-[1.5rem] font-normal tracking-tight text-white">Scan summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 border-t border-white/[0.08] sm:grid-cols-3">
              <SummaryValue label="Total findings" value={summary.totalFindings} />
              <SummaryValue label="Passed checks" value={summary.passedChecks} />
              <SummaryValue label="Security score" value={score ? `${score.value.toFixed(1)} / 100` : "—"} />
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">Finding distribution</p>
              <CardTitle className="mt-2 font-display text-[1.5rem] font-normal tracking-tight text-white">Severity summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 border-t border-white/[0.08] sm:grid-cols-4">
              {(["Critical", "High", "Medium", "Low"] as const).map((severity) => (
                <SummaryValue key={severity} label={severity} value={severityCounts?.[severity] ?? "—"} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {hasBackendSummary ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border border-white/[0.08] bg-white/[0.02] p-3">
          <span className="mr-1 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
            <LockKeyhole aria-hidden="true" className="size-3" />Latest scan actions
          </span>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/60 hover:bg-white/[0.06] hover:text-white">
            <Link href="#findings">View Findings <ArrowRight data-icon="inline-end" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/60 hover:bg-white/[0.06] hover:text-white">
            <Link href="#security-posture">View Security Posture <ArrowRight data-icon="inline-end" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/60 hover:bg-white/[0.06] hover:text-white">
            <Link href="#scan-history">View Scan History <ArrowRight data-icon="inline-end" /></Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { void onReportDownload("pdf"); }} disabled={reportLoading !== null} className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/60">
            <Download data-icon="inline-start" />{reportLoading === "pdf" ? "Downloading PDF…" : "Download PDF Report"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { void onReportDownload("json"); }} disabled={reportLoading !== null} className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/60">
            <Cloud data-icon="inline-start" />{reportLoading === "json" ? "Downloading JSON…" : "Export JSON"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-white/35">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Scan results, security score, history, and report exports appear only when returned by the existing CloudGuard backend.
        </p>
      )}
      {reportMessage ? (
        <p role={reportMessage.kind === "error" ? "alert" : "status"} aria-live={reportMessage.kind === "error" ? "assertive" : "polite"} className="mt-3 border border-white/[0.09] bg-white/[0.025] px-3 py-2 text-[9px] leading-4 text-white/60">
          {reportMessage.message}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">{connectionState === "testing" ? "Testing AWS connection" : ""}</p>
      <style jsx>{`
        @keyframes cg-security-scan-sweep {
          from { transform: translateX(-110%); }
          to { transform: translateX(340%); }
        }
        .cg-security-scan-progress {
          animation: cg-security-scan-sweep 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cg-security-scan-progress { animation: none; width: 100%; opacity: 0.45; }
        }
      `}</style>
    </section>
  );
}

export default SecurityScanSection;
