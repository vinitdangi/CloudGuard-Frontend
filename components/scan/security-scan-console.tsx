"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { SecurityScanSection } from "@/components/dashboard/security-scan-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EMPTY_DASHBOARD } from "@/lib/dashboard-data";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { getCurrentUser, logout } from "@/lib/api/auth";
import { getLatestScan } from "@/lib/api/scans";
import {
  DASHBOARD_DATA_KEY,
  getDashboardData,
  hasDashboardEndpointConfiguration,
  type DashboardDataResult,
} from "@/lib/api/scans";
import { downloadJsonReport, downloadPdfReport, saveReportFile } from "@/lib/api/reports";
import type {
  BackendSecurityScanResponse,
  LatestScanResponse,
  ReportFormat,
  SecurityScanResponse,
} from "@/lib/api/types";
import {
  AUTH_SESSION_KEY,
  clearAuthenticatedSession,
  fetchCurrentUserForSession,
  shouldRedirectToLogin,
} from "@/lib/auth-session.mjs";
import {
  createAwsConnectionState,
  updateAwsConnectionState,
} from "@/lib/aws-session-state.mjs";
import type { AwsConnectionState } from "@/lib/aws-session-state.mjs";

const LATEST_SCAN_KEY = "cloudguard:scan-page-latest";

function ScanPageHeader({
  username,
  onLogout,
  logoutLoading,
}: {
  username: string;
  onLogout: () => void;
  logoutLoading: boolean;
}) {
  return (
    <header className="border-b border-white/[0.08] bg-[#080a09]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1380px] items-center justify-between gap-3">
        <Link href="/" aria-label="CloudGuard home" className="inline-flex items-center gap-3 text-white">
          <span className="flex size-9 items-center justify-center border border-white/15 bg-white/[0.035] text-emerald-100/80">
            <ShieldCheck aria-hidden="true" className="size-[18px]" />
          </span>
          <span>
            <span className="block font-display text-xl leading-none tracking-tight">CloudGuard</span>
            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">AWS security console</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Badge variant="outline" className="hidden rounded-none border-white/10 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/50 sm:inline-flex">
            {username}
          </Badge>
          <Button asChild variant="outline" size="sm" className="h-9 rounded-none border-white/15 bg-transparent text-[9px] uppercase tracking-[0.08em] text-white/70 hover:bg-white/[0.06] hover:text-white">
            <Link href="/dashboard"><ArrowLeft data-icon="inline-start" />Dashboard</Link>
          </Button>
          <Button type="button" size="sm" onClick={onLogout} disabled={logoutLoading} className="h-9 rounded-none bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#101210] hover:bg-white/90 sm:px-4">
            <LogOut data-icon="inline-start" />{logoutLoading ? "Signing out" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function AccessGate({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080a09] px-5 text-white">
      <div className="w-full max-w-md border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-100/60">CloudGuard / Session</p>
        <h1 className="mt-3 font-display text-3xl tracking-tight">Authentication required</h1>
        <p role="status" className="mt-3 text-sm leading-6 text-white/55">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-none bg-white text-[#101210] hover:bg-white/90">
            <Link href="/login">Sign in <ArrowRight data-icon="inline-end" /></Link>
          </Button>
          {onRetry ? <Button type="button" variant="outline" onClick={onRetry} className="rounded-none border-white/15 bg-transparent text-white hover:bg-white/[0.06]">Retry session check</Button> : null}
        </div>
      </div>
    </main>
  );
}

function ScanResults({ scan }: { scan: BackendSecurityScanResponse }) {
  const groups = scan.findings.reduce<Record<string, typeof scan.findings>>((result, finding) => {
    const category = finding.category || "Other";
    (result[category] ??= []).push(finding);
    return result;
  }, {});
  const score = scan.security_score;

  return (
    <section aria-labelledby="scan-results-heading" className="mt-5 scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">CloudGuard / Backend results</p>
          <h2 id="scan-results-heading" className="font-display text-3xl tracking-tight text-white">Assessment results</h2>
          <p className="mt-2 text-[10px] text-white/40">{scan.aws_account_id} · {scan.aws_region} · {new Date(scan.scan_timestamp).toLocaleString()}</p>
        </div>
        <nav aria-label="Assessment dashboard sections" className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.06] hover:text-white">
            <Link href="/dashboard#security-posture">Security posture</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.06] hover:text-white">
            <Link href="/dashboard#findings">Findings</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.06] hover:text-white">
            <Link href="/dashboard#scan-history">Scan history</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-none border-white/10 bg-transparent text-[8px] uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.06] hover:text-white">
            <Link href="/dashboard#reports">Reports</Link>
          </Button>
        </nav>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3 lg:grid-cols-7">
        {[
          ["Security score", `${score.score.toFixed(1)} / 100`],
          ["Rating", score.rating],
          ["Checks", score.total_findings],
          ["Passed", score.passed_count],
          ["Critical", score.critical_count],
          ["High", score.high_count],
          ["Medium / Low", `${score.medium_count} / ${score.low_count}`],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 bg-[#0b0e0d] px-3 py-3 sm:px-4">
            <p className="truncate font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">{label}</p>
            <p className="mt-2 truncate font-display text-lg text-white">{value}</p>
          </div>
        ))}
      </div>

      {Object.keys(groups).length ? (
        <div className="space-y-4">
          {Object.entries(groups).map(([category, findings]) => (
            <div key={category} className="border border-white/[0.09] bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                <h3 className="font-display text-xl text-white">{category}</h3>
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">{findings.length} checks</span>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {findings.map((finding, index) => (
                  <article key={finding.finding_id ?? `${finding.check}-${finding.resource}-${index}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[11px] font-medium text-white/85">{finding.check}</h4>
                        <Badge variant="outline" className={`rounded-none px-2 py-0.5 font-mono text-[8px] uppercase ${finding.passed ? "border-emerald-200/20 text-emerald-100/70" : "border-amber-200/20 text-amber-100/75"}`}>
                          {finding.passed ? "PASS" : finding.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-[8px] text-white/35">{finding.resource}</p>
                      <p className="mt-2 text-[10px] leading-5 text-white/65">{finding.issue || (finding.passed ? "The check passed." : "No additional issue details were returned.")}</p>
                      {finding.impact ? <p className="mt-1 text-[9px] leading-4 text-white/40">Impact: {finding.impact}</p> : null}
                      {!finding.passed && finding.recommendation ? <p className="mt-2 text-[9px] leading-4 text-emerald-100/60">Recommendation: {finding.recommendation}</p> : null}
                      {!finding.passed && finding.remediation && finding.remediation !== finding.recommendation ? <p className="mt-1 text-[9px] leading-4 text-white/45">Remediation: {finding.remediation}</p> : null}
                    </div>
                    <p className="font-mono text-[8px] text-white/30 sm:text-right">Risk {finding.risk_score.toFixed(1)}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-white/[0.08] bg-white/[0.02] px-5 py-8 text-center text-[11px] text-white/50">
          The backend completed the scan and returned no findings.
        </div>
      )}
    </section>
  );
}

export default function SecurityScanConsole() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const {
    data: authSession,
    error: authError,
    isLoading: authLoading,
    mutate: mutateAuthSession,
  } = useSWR(AUTH_SESSION_KEY, () => fetchCurrentUserForSession(getCurrentUser), {
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  });
  const authenticatedUser = authSession?.authenticated ? authSession.user : null;
  const dashboardApiEnabled = hasDashboardEndpointConfiguration();
  const { data: dashboardData } = useSWR<DashboardDataResult>(
    authenticatedUser && dashboardApiEnabled ? DASHBOARD_DATA_KEY : null,
    () => getDashboardData(),
    { shouldRetryOnError: false },
  );
  const { data: latestScanData, mutate: mutateLatestScan } = useSWR<LatestScanResponse>(
    authenticatedUser ? LATEST_SCAN_KEY : null,
    () => getLatestScan(),
    { shouldRetryOnError: false },
  );
  const [connection, setConnection] = useState<AwsConnectionState>(() => createAwsConnectionState());
  const [scanResult, setScanResult] = useState<BackendSecurityScanResponse | null>(null);
  const [reportLoading, setReportLoading] = useState<ReportFormat | null>(null);
  const [reportMessage, setReportMessage] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (shouldRedirectToLogin(authLoading, authError)) router.replace("/login");
  }, [authError, authLoading, router]);

  const snapshot = dashboardData?.snapshot ?? EMPTY_DASHBOARD;

  useEffect(() => {
    if (snapshot.region) {
      setConnection((current) => (
        current.status === "not-connected" && !current.accessKeyId && !current.secretAccessKey
          ? { ...current, region: snapshot.region ?? current.region }
          : current
      ));
    }
  }, [snapshot.region]);

  const updateConnection = (changes: Partial<AwsConnectionState>) => {
    setConnection((current) => updateAwsConnectionState(current, changes));
  };

  const handleScanResult = (result: SecurityScanResponse) => {
    setScanResult(result.backendResponse);
    void mutateLatestScan({ scan: result.backendResponse }, { revalidate: false });
  };

  const handleReportDownload = async (format: ReportFormat) => {
    setReportMessage(null);
    setReportLoading(format);
    try {
      if (format === "pdf") {
        saveReportFile(await downloadPdfReport(), "pdf");
      } else {
        const report = await downloadJsonReport();
        saveReportFile(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "json");
      }
      setReportMessage({ kind: "success", message: `${format.toUpperCase()} report downloaded from CloudGuard.` });
    } catch (error) {
      setReportMessage({ kind: "error", message: apiErrorMessage(error, `The CloudGuard ${format.toUpperCase()} report could not be downloaded.`) });
    } finally {
      setReportLoading(null);
    }
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setConnection(createAwsConnectionState());
    try {
      await logout();
      clearAuthenticatedSession();
      await mutateAuthSession(undefined, { revalidate: false });
      await mutate(DASHBOARD_DATA_KEY, undefined, { revalidate: false });
      await mutate(LATEST_SCAN_KEY, undefined, { revalidate: false });
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.code === "authentication") {
        clearAuthenticatedSession();
        await mutateAuthSession(undefined, { revalidate: false });
        await mutate(DASHBOARD_DATA_KEY, undefined, { revalidate: false });
        await mutate(LATEST_SCAN_KEY, undefined, { revalidate: false });
        router.replace("/");
      } else {
        setReportMessage({ kind: "error", message: apiErrorMessage(error, "CloudGuard could not end the session.") });
      }
    } finally {
      setLogoutLoading(false);
    }
  };

  if (authLoading) {
    return <AccessGate message="Checking your CloudGuard session before opening AWS scan controls…" />;
  }
  if (!authenticatedUser) {
    const message = authError instanceof ApiError && authError.code !== "authentication"
      ? "CloudGuard could not verify your session. Retry the session check or sign in again."
      : "Sign in to configure AWS access and run a security assessment.";
    return <AccessGate message={message} onRetry={() => { void mutateAuthSession(); }} />;
  }

  const latestScan: BackendSecurityScanResponse | null = scanResult ?? latestScanData?.scan ?? null;

  return (
    <div className="min-h-screen bg-[#080a09] text-white">
      <ScanPageHeader username={authenticatedUser.username} onLogout={() => { void handleLogout(); }} logoutLoading={logoutLoading} />
      <main className="mx-auto w-full max-w-[1380px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-10 xl:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-100/55">CloudGuard / AWS assessment</p>
            <h1 className="font-display text-[clamp(2.5rem,6vw,4.2rem)] leading-[0.95] tracking-[-0.05em] text-white">Security <span className="text-white/45">Scan</span></h1>
            <p className="mt-3 max-w-2xl text-[11px] leading-5 text-white/45">Connect to AWS, run the existing CloudGuard checks, and review the results returned by the authenticated API.</p>
          </div>
          <Badge variant="outline" className="rounded-none border-white/10 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/45">
            {authenticatedUser.username}
          </Badge>
        </div>

        <SecurityScanSection
          snapshot={snapshot}
          connection={connection}
          onConnectionChange={updateConnection}
          onReportDownload={handleReportDownload}
          reportLoading={reportLoading}
          reportMessage={reportMessage}
          onScanResult={handleScanResult}
          dashboardHrefPrefix="/dashboard"
        />

        {latestScan ? <ScanResults scan={latestScan} /> : null}
      </main>
    </div>
  );
}
