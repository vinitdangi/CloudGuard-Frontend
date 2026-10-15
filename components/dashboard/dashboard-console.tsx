"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  CloudCog,
  Download,
  FileJson2,
  FileText,
  Gauge,
  Globe2,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ScanLine,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { AsciiScene } from "@/components/landing/ascii-scene";
import { SecurityScanSection } from "@/components/dashboard/security-scan-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EMPTY_DASHBOARD,
  type DashboardSnapshot,
  type FindingSeverity,
} from "@/lib/dashboard-data";
import { apiErrorMessage, ApiError } from "@/lib/api/client";
import { getCurrentUser, logout } from "@/lib/api/auth";
import {
  AUTH_SESSION_KEY,
  clearAuthenticatedSession,
  fetchCurrentUserForSession,
  shouldRedirectToLogin,
} from "@/lib/auth-session.mjs";
import { DASHBOARD_DATA_KEY, getDashboardData, hasDashboardEndpointConfiguration, type DashboardDataResult } from "@/lib/api/scans";
import { downloadJsonReport, downloadPdfReport, saveReportFile } from "@/lib/api/reports";
import type { ReportFormat } from "@/lib/api/types";
import {
  createAwsConnectionState,
  updateAwsConnectionState,
} from "@/lib/aws-session-state.mjs";
import type { AwsConnectionState } from "@/lib/aws-session-state.mjs";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const navigation: NavigationItem[] = [
  { label: "Overview", href: "/dashboard#overview", icon: LayoutDashboard },
  { label: "Security Scan", href: "/dashboard#security-scan", icon: ScanLine },
  { label: "Findings", href: "/dashboard#findings", icon: ShieldAlert },
  { label: "Security Posture", href: "/dashboard#security-posture", icon: Gauge },
  { label: "Scan History", href: "/dashboard#scan-history", icon: History },
  { label: "Reports", href: "/dashboard#reports", icon: FileText },
  { label: "AWS Configuration", href: "/dashboard#aws-configuration", icon: CloudCog },
  { label: "Settings", href: "/dashboard#settings", icon: Settings2 },
];

const severityStyles: Record<FindingSeverity, string> = {
  Critical: "border-rose-300/25 bg-rose-300/[0.08] text-rose-100",
  High: "border-orange-200/25 bg-orange-200/[0.07] text-orange-100",
  Medium: "border-amber-200/25 bg-amber-200/[0.07] text-amber-100",
  Low: "border-sky-200/25 bg-sky-200/[0.07] text-sky-100",
};

const severityDots: Record<FindingSeverity, string> = {
  Critical: "bg-rose-300 shadow-[0_0_12px_rgba(253,164,175,0.65)]",
  High: "bg-orange-200 shadow-[0_0_12px_rgba(253,186,116,0.55)]",
  Medium: "bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.5)]",
  Low: "bg-sky-200 shadow-[0_0_12px_rgba(125,211,252,0.45)]",
};

function formatMetric(value: number | undefined) {
  return value === undefined ? "—" : value.toLocaleString();
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="CloudGuard home"
      className="group inline-flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center border border-white/15 bg-white/[0.035] text-emerald-100/80 transition-colors group-hover:border-white/30">
        <ShieldCheck aria-hidden="true" className="size-[18px]" />
      </span>
        <span className="min-w-0">
        <span className={`${compact ? "hidden min-[360px]:block" : "block"} font-display text-[1.45rem] leading-none tracking-tight text-white`}>CloudGuard</span>
        {!compact ? <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">AWS security console</span> : null}
      </span>
    </Link>
  );
}

function SidebarNavigation({
  activeItem,
  onNavigate,
  mobile = false,
}: {
  activeItem: string;
  onNavigate: (label: string) => void;
  mobile?: boolean;
}) {
  return (
    <nav aria-label="Console navigation" className="flex flex-col gap-1">
      <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Workspace</p>
      {navigation.map(({ label, href, icon: Icon }) => {
        const active = activeItem === label;
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(label)}
            className={`group relative flex min-h-10 items-center gap-3 border px-3 text-[12px] transition-[background-color,border-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              active
                ? "border-white/10 bg-white/[0.075] text-white"
                : "border-transparent text-white/45 hover:translate-x-0.5 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white/80"
            } ${mobile ? "w-full" : "w-full"}`}
          >
            {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-px bg-emerald-100/80 shadow-[0_0_12px_rgba(167,243,208,0.45)]" /> : null}
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${active ? "text-emerald-100/85" : "text-white/35 group-hover:text-white/70"}`} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {active ? <ArrowDownRight aria-hidden="true" className="size-3 text-white/35" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.21em] text-white/35">{eyebrow}</p>
        <h2 className="font-display text-[1.65rem] leading-none tracking-tight text-white sm:text-[1.85rem]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatePill({ connected }: { connected: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`h-7 gap-2 rounded-none px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
        connected
          ? "border-emerald-200/20 bg-emerald-100/[0.06] text-emerald-100/80"
          : "border-amber-200/20 bg-amber-100/[0.05] text-amber-100/80"
      }`}
    >
      <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-200 shadow-[0_0_10px_rgba(167,243,208,0.7)]" : "bg-amber-200/80"}`} />
      {connected ? "AWS connected" : "AWS unverified"}
    </Badge>
  );
}

function SeverityCard({
  severity,
  count,
}: {
  severity: FindingSeverity;
  count: number | undefined;
}) {
  return (
    <Card className="group gap-0 rounded-none border-white/[0.09] bg-white/[0.025] py-0 shadow-none transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.04]">
      <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] text-white/60">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${severityDots[severity]}`} />
            {severity}
          </span>
          <Badge variant="outline" className={`rounded-none px-1.5 py-0 font-mono text-[8px] uppercase tracking-[0.12em] ${severityStyles[severity]}`}>
            {severity === "Critical" ? "Urgent" : "Risk"}
          </Badge>
        </div>
        <p className="mt-4 font-display text-4xl leading-none tracking-tight text-white sm:text-[2.6rem]">{formatMetric(count)}</p>
        <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/30">{count === undefined ? "Awaiting scan data" : "Open findings"}</p>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  footnote,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  footnote: string;
}) {
  return (
    <Card className="gap-0 rounded-none border-white/[0.08] bg-white/[0.02] py-0 shadow-none">
      <CardContent className="flex min-h-[108px] items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/35">{label}</p>
          <p className="mt-3 font-display text-[1.9rem] leading-none text-white">{value}</p>
          <p className="mt-2 text-[10px] leading-4 text-white/35">{footnote}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center border border-white/[0.09] bg-white/[0.025] text-white/45">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 flex size-9 items-center justify-center border border-white/10 bg-white/[0.025] text-white/40">
        <CircleHelp aria-hidden="true" className="size-4" />
      </span>
      <p className="text-sm text-white/75">{title}</p>
      <p className="mt-1.5 max-w-sm text-[11px] leading-5 text-white/40">{body}</p>
    </div>
  );
}

export function DashboardConsole({ snapshot = EMPTY_DASHBOARD }: { snapshot?: DashboardSnapshot }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const dashboardApiEnabled = hasDashboardEndpointConfiguration();
  const { data: apiData, error: dashboardApiError, isLoading: dashboardLoading } = useSWR<DashboardDataResult>(
    dashboardApiEnabled ? DASHBOARD_DATA_KEY : null,
    () => getDashboardData(),
    { shouldRetryOnError: false },
  );
  const dashboardSnapshot = apiData?.snapshot ?? snapshot;
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
  useEffect(() => {
    if (shouldRedirectToLogin(authLoading, authError)) {
      router.replace("/login");
    }
  }, [authError, authLoading, router]);
  const sessionLabel = authenticatedUser
    ? `Signed in as ${authenticatedUser.username}`
    : authLoading
      ? "Checking session"
      : authError instanceof ApiError && authError.code !== "authentication"
        ? "Session check failed"
        : "Not signed in";
  const [activeItem, setActiveItem] = useState("Overview");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [reportLoading, setReportLoading] = useState<ReportFormat | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [awsConnection, setAwsConnection] = useState<AwsConnectionState>(() => createAwsConnectionState(snapshot.region ?? "us-east-1"));

  const updateAwsConnection = (changes: Partial<AwsConnectionState>) => {
    setAwsConnection((current) => updateAwsConnectionState(current, changes));
  };
  const clearAwsConnection = () => {
    setAwsConnection(createAwsConnectionState());
  };

  useEffect(() => {
    const latestRegion = dashboardSnapshot.region;
    if (latestRegion) {
      setAwsConnection((current) => (
        current.status === "not-connected" && !current.accessKeyId && !current.secretAccessKey
          ? { ...current, region: latestRegion }
          : current
      ));
    }
  }, [dashboardSnapshot.region]);

  useEffect(() => {
    const syncActiveSection = () => {
      const selectedItem = navigation.find(({ href }) => {
        const targetRoute = new URL(href, window.location.origin);
        return targetRoute.pathname === window.location.pathname && targetRoute.hash === window.location.hash;
      })?.label ?? "Overview";
      setActiveItem(selectedItem);
    };

    syncActiveSection();
    const initialTarget = document.getElementById(window.location.hash.slice(1));
    initialTarget?.scrollIntoView({ behavior: "instant", block: "start" });
    window.addEventListener("hashchange", syncActiveSection);
    return () => window.removeEventListener("hashchange", syncActiveSection);
  }, []);

  const hasLiveScore = dashboardSnapshot.score !== null;
  const displayedScore = dashboardSnapshot.score;
  const scoreValue = Math.max(0, Math.min(100, displayedScore?.value ?? 0));
  const severityCounts = dashboardSnapshot.severityCounts;
  const summary = dashboardSnapshot.summary;

  const navigateTo = (label: string) => {
    setActiveItem(label);
    setMobileNavigationOpen(false);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setActionMessage(null);
    clearAwsConnection();
    try {
      await logout();
      clearAuthenticatedSession();
      await mutateAuthSession(undefined, { revalidate: false });
      await mutate(DASHBOARD_DATA_KEY, undefined, { revalidate: false });
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.code === "authentication") {
        clearAuthenticatedSession();
        await mutateAuthSession(undefined, { revalidate: false });
        await mutate(DASHBOARD_DATA_KEY, undefined, { revalidate: false });
        router.replace("/");
      } else {
        setActionMessage({ kind: "error", message: apiErrorMessage(error, "CloudGuard could not end the session.") });
      }
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleReportDownload = async (format: ReportFormat) => {
    setActionMessage(null);
    setReportLoading(format);
    try {
      if (format === "pdf") {
        const report = await downloadPdfReport();
        saveReportFile(report, "pdf");
      } else {
        const report = await downloadJsonReport();
        const file = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        saveReportFile(file, "json");
      }
      setActionMessage({ kind: "success", message: `${format.toUpperCase()} report downloaded from CloudGuard.` });
    } catch (error) {
      setActionMessage({ kind: "error", message: apiErrorMessage(error, `The CloudGuard ${format.toUpperCase()} report could not be downloaded.`) });
    } finally {
      setReportLoading(null);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080a09] text-white selection:bg-[#eca8d6]/30">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_0%,rgba(67,110,89,0.13),transparent_38%),radial-gradient(ellipse_at_12%_88%,rgba(236,168,214,0.035),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:76px_76px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      </div>

      <div className="relative z-10 mx-auto min-h-screen max-w-[1720px] lg:grid lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/[0.08] bg-[#090c0b]/90 px-4 py-6 backdrop-blur-xl lg:flex xl:px-5">
          <div className="px-2">
            <BrandMark />
          </div>

          <div className="mt-10 flex-1 overflow-y-auto">
            <SidebarNavigation activeItem={activeItem} onNavigate={navigateTo} />
          </div>

          <div className="mt-6 border-t border-white/[0.08] pt-4">
            <div className="flex items-center gap-3 px-2 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] font-mono text-[10px] text-white/65">CG</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-white/75">{authenticatedUser?.fullName ?? "CloudGuard operator"}</span>
                <span className="mt-1 block truncate font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">{sessionLabel}</span>
              </span>
              <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-white/30" />
            </div>
            <p className="mt-2 px-2 text-[9px] leading-4 text-white/30">Identity is provided by the connected Python authentication service.</p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080a09]/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
                  aria-expanded={mobileNavigationOpen}
                  aria-controls="mobile-console-navigation"
                  onClick={() => setMobileNavigationOpen((open) => !open)}
                  className="size-9 shrink-0 rounded-none border-white/15 bg-white/[0.025] text-white hover:bg-white/[0.08]"
                >
                  {mobileNavigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                </Button>
                <BrandMark compact />
              </div>

              <div className="hidden min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35 lg:flex">
                <span>CloudGuard</span><span aria-hidden="true" className="text-white/20">/</span><span className="text-white/70">{activeItem}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="hidden items-center gap-2 border border-white/[0.08] px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.11em] text-white/45 sm:inline-flex">
                  <LockKeyhole aria-hidden="true" className="size-3" />
                  {sessionLabel}
                </span>
                {authenticatedUser ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="h-9 rounded-none bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#101210] hover:bg-white/90 sm:px-4"
                  >
                    <LogOut data-icon="inline-start" />{logoutLoading ? "Signing out" : "Sign Out"}
                  </Button>
                ) : !authLoading ? (
                  <Button asChild size="sm" className="h-9 rounded-none bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#101210] hover:bg-white/90 sm:px-4">
                    <Link href="/login"><ArrowRight data-icon="inline-start" />Sign In</Link>
                  </Button>
                ) : null}
              </div>
            </div>
            {mobileNavigationOpen ? (
              <div id="mobile-console-navigation" className="mt-3 border-t border-white/10 pt-3 lg:hidden">
                <SidebarNavigation activeItem={activeItem} onNavigate={navigateTo} mobile />
                <p className="px-3 pb-2 pt-3 text-[10px] leading-4 text-white/35">{sessionLabel}</p>
              </div>
            ) : null}
          </header>

          <div className="cg-console-enter mx-auto w-full max-w-[1380px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-10 xl:px-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatePill connected={awsConnection.status === "connected"} />
                <Badge variant="outline" className="h-7 gap-2 rounded-none border-white/[0.09] bg-white/[0.02] px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/50">
                  <Globe2 aria-hidden="true" className="size-3" />
                  {dashboardSnapshot.region ?? "Region not set"}
                </Badge>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/30">Control plane <span className="text-white/15">·</span> AWS</span>
            </div>

            <section id="overview" className="scroll-mt-24">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.21em] text-white/40">
                    <span className="size-1.5 rounded-full bg-emerald-100/70 shadow-[0_0_12px_rgba(167,243,208,0.55)]" />
                    CloudGuard / Security console
                  </p>
                  <h1 className="font-display text-[clamp(2.5rem,5vw,4.2rem)] leading-[0.95] tracking-[-0.05em] text-white">Cloud Security <span className="text-white/45">Overview</span></h1>
                  <p className="mt-3 max-w-2xl text-[12px] leading-5 text-white/45">A focused view of your AWS security posture, checks, and findings.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-right font-mono text-[8px] uppercase leading-4 tracking-[0.12em] text-white/35 sm:text-[9px]">Last scan<br /><span className="text-white/65">{dashboardSnapshot.lastScan ?? "No scan recorded"}</span></span>
                  <Button type="button" onClick={() => { navigateTo("Security Scan"); document.getElementById("security-scan")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="h-10 rounded-none bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#101210] transition-transform hover:-translate-y-0.5 hover:bg-white/90">
                    <ScanLine data-icon="inline-start" />Run Security Scan
                  </Button>
                </div>
              </div>

              {dashboardLoading ? (
                <p role="status" className="mb-4 border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[10px] text-white/45">Loading data from the CloudGuard API…</p>
              ) : dashboardApiError ? (
                <p role="alert" className="mb-4 border border-rose-200/15 bg-rose-100/[0.025] px-4 py-3 text-[10px] leading-5 text-rose-50/75">{apiErrorMessage(dashboardApiError, "CloudGuard dashboard data could not be loaded.")}</p>
              ) : apiData?.errors.length ? (
                <p role="status" className="mb-4 border border-amber-200/15 bg-amber-100/[0.025] px-4 py-3 text-[10px] leading-5 text-amber-50/70">Some dashboard data is unavailable: {apiData.errors[0]}</p>
              ) : null}

              {awsConnection.status !== "connected" ? (
                <div role="status" className="mb-5 flex flex-col gap-2 border border-amber-200/15 bg-amber-100/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-100/75" />
                    <div>
                      <p className="text-[11px] font-medium text-amber-50/90">AWS connection has not been verified in this session.</p>
                      <p className="mt-1 text-[10px] leading-4 text-white/40">Latest scan data may still be available below. Run the connection test to verify current AWS access.</p>
                    </div>
                  </div>
                  <Link href="#aws-configuration" onClick={() => navigateTo("AWS Configuration")} className="ml-7 inline-flex min-h-8 items-center gap-1.5 text-[10px] font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:ml-0">
                    AWS configuration <ArrowUpRight aria-hidden="true" className="size-3" />
                  </Link>
                </div>
              ) : null}

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(245px,0.8fr)]">
                <Card className="relative isolate min-h-[252px] overflow-hidden gap-0 rounded-none border-white/10 bg-[#0c100e] py-0 shadow-none sm:min-h-[268px]">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.42] [mask-image:radial-gradient(ellipse_at_74%_48%,black_3%,transparent_66%)]">
                    <AsciiScene />
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_50%,rgba(87,143,111,0.11),transparent_48%)]" />
                  <CardHeader className="relative z-10 flex grid-cols-1 flex-row items-start justify-between gap-3 px-5 pb-0 pt-5 sm:px-7 sm:pt-7">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/40">CloudGuard · Security Score</p>
                      <CardTitle className="mt-2 font-display text-2xl font-normal tracking-tight text-white sm:text-[1.8rem]">Security score</CardTitle>
                      <CardDescription className="mt-1 max-w-xs text-[11px] leading-5 text-white/45">The authoritative score returned by the existing CloudGuard scan.</CardDescription>
                    </div>
                    <Badge variant="outline" className={`shrink-0 rounded-none px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${hasLiveScore ? "border-emerald-100/20 bg-emerald-100/[0.05] text-emerald-100/75" : "border-amber-100/20 bg-amber-100/[0.04] text-amber-100/70"}`}>
                      {hasLiveScore ? "Latest scan" : "Awaiting data"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:pb-7">
                    <div className="flex items-end gap-3">
                      <p className="font-display text-[4.4rem] leading-[0.82] tracking-[-0.065em] text-white sm:text-[5.8rem]">{displayedScore?.value.toFixed(1) ?? "—"}</p>
                      <p className="pb-1 font-mono text-[10px] text-white/35">/ 100</p>
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-6 sm:mt-0 sm:justify-end sm:gap-8">
                      <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-white/35">Rating</p>
                        <p className={`mt-1.5 text-[13px] font-medium ${displayedScore?.rating === "Critical" ? "text-rose-100/90" : "text-emerald-100/90"}`}>{displayedScore?.rating ?? "No score returned"}</p>
                        <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">{dashboardSnapshot.lastScan ?? "No scan recorded"}</p>
                      </div>
                      <div
                        role="img"
                        aria-label={displayedScore ? `${displayedScore.value.toFixed(1)} out of 100` : "No security score returned"}
                        className="cg-score-ring relative flex size-[74px] shrink-0 items-center justify-center rounded-full sm:size-[90px]"
                        style={{ background: `conic-gradient(from -90deg, rgba(167,243,208,0.85) ${scoreValue}%, rgba(255,255,255,0.08) ${scoreValue}% 100%)` }}
                      >
                        <span aria-hidden="true" className="absolute inset-[4px] rounded-full border border-white/[0.06] bg-[#0c100e] sm:inset-[5px]" />
                        <span className="relative z-10 font-mono text-[9px] text-white/70">{hasLiveScore ? `${scoreValue.toFixed(1)}%` : "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden gap-0 rounded-none border-white/10 bg-white/[0.025] py-0 shadow-none">
                  <CardHeader className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
                    <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-white/35">AWS account context</p>
                    <CardTitle className="mt-2 font-display text-[1.65rem] font-normal tracking-tight text-white">Connection</CardTitle>
                    <CardDescription className="text-[11px] text-white/40">Latest completed scan target; current access is verified separately.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-0 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] py-3">
                      <span className="flex items-center gap-2 text-[10px] text-white/45"><Cloud aria-hidden="true" className="size-3.5" />Latest scan account</span>
                      <span className="max-w-[58%] truncate text-right font-mono text-[9px] text-white/70">{dashboardSnapshot.account ?? "Not connected"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] py-3">
                      <span className="flex items-center gap-2 text-[10px] text-white/45"><Globe2 aria-hidden="true" className="size-3.5" />Latest scan region</span>
                      <span className="max-w-[58%] truncate text-right font-mono text-[9px] text-white/70">{dashboardSnapshot.region ?? "Not configured"}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 border border-white/[0.08] bg-black/10 px-3 py-2.5">
                      <span className={`size-1.5 shrink-0 rounded-full ${awsConnection.status === "connected" ? "bg-emerald-200" : "bg-amber-200/80"}`} />
                      <span className="text-[10px] text-white/60">{awsConnection.status === "connected" ? "Connection verified this session" : "Current AWS connection unverified"}</span>
                    </div>
                    <Link href="#aws-configuration" onClick={() => navigateTo("AWS Configuration")} className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[10px] text-white/45 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                      Configure AWS <ArrowRight aria-hidden="true" className="size-3" />
                    </Link>
                  </CardContent>
                </Card>
              </div>
              {!hasLiveScore ? <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">A score appears after the existing CloudGuard API returns a completed scan.</p> : null}
            </section>

            <section id="security-posture" className="mt-10 scroll-mt-24 sm:mt-12">
              <SectionHeading eyebrow="Risk distribution" title="Risk overview" description="Severity counts are supplied by the CloudGuard scan. An em dash means no scan data is connected." />
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {(["Critical", "High", "Medium", "Low"] as const).map((severity) => (
                  <SeverityCard key={severity} severity={severity} count={severityCounts?.[severity]} />
                ))}
              </div>
            </section>

            <section className="mt-10 scroll-mt-24 sm:mt-12" aria-labelledby="scan-summary-title">
              <SectionHeading eyebrow="Assessment telemetry" title="Scan summary" description="No totals are inferred before the first completed scan." />
              <h2 id="scan-summary-title" className="sr-only">Scan summary metrics</h2>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={ShieldAlert} label="Total findings" value={formatMetric(summary?.totalFindings)} footnote="From the latest scan" />
                <MetricCard icon={Check} label="Passed checks" value={formatMetric(summary?.passedChecks)} footnote="Passed CloudGuard checks" />
                <MetricCard icon={AlertTriangle} label="Failed checks" value={formatMetric(summary?.failedChecks)} footnote="Checks requiring review" />
                <MetricCard icon={Activity} label="AWS checks covered" value={formatMetric(summary?.servicesChecked)} footnote="Implemented check groups" />
              </div>
            </section>

            <SecurityScanSection snapshot={dashboardSnapshot} connection={awsConnection} onConnectionChange={updateAwsConnection} onReportDownload={handleReportDownload} reportLoading={reportLoading} reportMessage={actionMessage} />

            <section id="findings" className="mt-10 scroll-mt-24 sm:mt-12">
              <SectionHeading
                eyebrow="Actionable security issues"
                title="Recent findings"
                description="Findings will display the severity, affected resource, category, and backend recommendation returned by CloudGuard."
                action={<Badge variant="outline" className="rounded-none border-white/[0.1] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">{dashboardSnapshot.findings.length ? `${dashboardSnapshot.findings.length} findings` : "No scan data"}</Badge>}
              />
              <Card className="gap-0 overflow-hidden rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.02] font-mono text-[8px] uppercase tracking-[0.13em] text-white/35">
                        <th scope="col" className="px-4 py-3 font-normal sm:px-5">Severity</th>
                        <th scope="col" className="px-4 py-3 font-normal">Finding / check</th>
                        <th scope="col" className="px-4 py-3 font-normal">AWS resource</th>
                        <th scope="col" className="px-4 py-3 font-normal">Category</th>
                        <th scope="col" className="px-4 py-3 font-normal">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardSnapshot.findings.length ? dashboardSnapshot.findings.map((finding) => (
                        <tr key={finding.id} className="border-b border-white/[0.06] text-[10px] last:border-0 hover:bg-white/[0.025]">
                          <td className="px-4 py-3.5 sm:px-5"><Badge variant="outline" className={`rounded-none px-2 py-1 text-[8px] ${severityStyles[finding.severity]}`}><span aria-hidden="true" className={`size-1 rounded-full ${severityDots[finding.severity]}`} />{finding.severity}</Badge></td>
                          <td className="max-w-[220px] px-4 py-3.5"><p className="font-medium text-white/80">{finding.name}</p><p className="mt-1 text-[9px] leading-4 text-white/40">{finding.description}</p></td>
                          <td className="max-w-[150px] truncate px-4 py-3.5 font-mono text-[9px] text-white/55">{finding.resource}</td>
                          <td className="px-4 py-3.5 text-white/55">{finding.category}</td>
                          <td className="max-w-[230px] px-4 py-3.5 text-white/50">{finding.recommendation}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="p-0"><EmptyState title={dashboardSnapshot.hasCompleteScan ? "No failed findings in latest scan" : "No scan findings available"} body={dashboardSnapshot.hasCompleteScan ? "The completed scan returned no failed checks." : "Findings will appear here after the existing CloudGuard API returns a complete scan."} /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

            <section id="scan-history" className="mt-10 scroll-mt-24 sm:mt-12">
              <SectionHeading eyebrow="Assessment timeline" title="Recent scans" description="History will be supplied by the existing SQLite Scan History implementation." action={<span className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/30">Last scan · {dashboardSnapshot.lastScan ?? "None"}</span>} />
              <Card className="gap-0 overflow-hidden rounded-none border-white/[0.09] bg-white/[0.02] py-0 shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.02] font-mono text-[8px] uppercase tracking-[0.13em] text-white/35">
                        <th scope="col" className="px-4 py-3 font-normal sm:px-5">Date / time</th>
                        <th scope="col" className="px-4 py-3 font-normal">AWS account</th>
                        <th scope="col" className="px-4 py-3 font-normal">Region</th>
                        <th scope="col" className="px-4 py-3 font-normal">Score</th>
                        <th scope="col" className="px-4 py-3 font-normal">Findings</th>
                        <th scope="col" className="px-4 py-3 font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardSnapshot.scans.length ? dashboardSnapshot.scans.map((scan) => (
                        <tr key={scan.id} className="border-b border-white/[0.06] text-[10px] text-white/60 last:border-0 hover:bg-white/[0.025]">
                          <td className="px-4 py-3.5 sm:px-5">{scan.dateTime}</td><td className="px-4 py-3.5 font-mono text-[9px]">{scan.account}</td><td className="px-4 py-3.5 font-mono text-[9px]">{scan.region}</td><td className="px-4 py-3.5 font-medium text-white/80">{scan.securityScore.toFixed(1)} <span className="text-[9px] font-normal text-white/35">/ 100 · {scan.rating}</span></td><td className="px-4 py-3.5">{scan.findingCount}</td><td className="px-4 py-3.5"><Badge variant="outline" className="rounded-none border-white/10 text-[8px] text-white/60">{scan.status}</Badge></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="p-0"><EmptyState title="Scan history is empty" body="Completed scans from the existing CloudGuard SQLite history will appear here." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

            <section id="reports" className="mt-10 scroll-mt-24 sm:mt-12">
              <SectionHeading eyebrow="Operator shortcuts" title="Quick actions" description="Actions use the existing CloudGuard API when its origin and confirmed endpoint paths are configured." />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button type="button" onClick={() => { navigateTo("Security Scan"); document.getElementById("security-scan")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="group h-auto min-h-[86px] justify-between rounded-none border border-white/10 bg-white text-left text-[#101210] hover:bg-white/90">
                  <span className="flex items-start gap-3"><ScanLine data-icon="inline-start" className="mt-0.5" /><span><span className="block text-[10px] font-semibold uppercase tracking-[0.1em]">Run Security Scan</span><span className="mt-1 block text-[9px] font-normal text-black/55">Configure AWS access and scan options below</span></span></span>
                  <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Button>
                <Button asChild variant="outline" className="group h-auto min-h-[86px] justify-between rounded-none border-white/10 bg-white/[0.025] px-4 text-left text-white hover:bg-white/[0.06]">
                  <Link href="#aws-configuration" onClick={() => navigateTo("AWS Configuration")}><span className="flex items-start gap-3"><CloudCog data-icon="inline-start" className="mt-0.5" /><span><span className="block text-[10px] font-semibold uppercase tracking-[0.1em]">AWS Configuration</span><span className="mt-1 block text-[9px] font-normal text-white/40">Review connection status</span></span></span><ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="group h-auto min-h-[86px] justify-between rounded-none border-white/10 bg-white/[0.025] px-4 text-left text-white hover:bg-white/[0.06]">
                  <Link href="#findings" onClick={() => navigateTo("Findings")}><span className="flex items-start gap-3"><ShieldAlert data-icon="inline-start" className="mt-0.5" /><span><span className="block text-[10px] font-semibold uppercase tracking-[0.1em]">View Findings</span><span className="mt-1 block text-[9px] font-normal text-white/40">Review scan output</span></span></span><ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => handleReportDownload("pdf")} disabled={reportLoading !== null} className="h-full min-h-[86px] flex-col gap-2 rounded-none border-white/10 bg-white/[0.025] px-2 text-center text-white hover:bg-white/[0.06]">
                    <Download aria-hidden="true" className="size-4 text-white/55" /><span className="text-[9px] uppercase tracking-[0.08em]">{reportLoading === "pdf" ? "Downloading PDF…" : "PDF report"}</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleReportDownload("json")} disabled={reportLoading !== null} className="h-full min-h-[86px] flex-col gap-2 rounded-none border-white/10 bg-white/[0.025] px-2 text-center text-white hover:bg-white/[0.06]">
                    <FileJson2 aria-hidden="true" className="size-4 text-white/55" /><span className="text-[9px] uppercase tracking-[0.08em]">{reportLoading === "json" ? "Downloading JSON…" : "JSON export"}</span>
                  </Button>
                </div>
              </div>
              {actionMessage ? <p role={actionMessage.kind === "error" ? "alert" : "status"} aria-live={actionMessage.kind === "error" ? "assertive" : "polite"} className="mt-3 border border-white/[0.09] bg-white/[0.025] px-4 py-3 text-[10px] leading-5 text-white/60">{actionMessage.message}</p> : null}
            </section>


            <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
              <span>CloudGuard · AWS cloud security control plane</span>
              <span>Implemented checks only · IAM / S3 / Network / CloudTrail</span>
            </footer>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes cg-console-enter {
          from { opacity: 0; transform: translate3d(0, 10px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .cg-console-enter { animation: cg-console-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes cg-score-in {
          from { opacity: 0.35; transform: rotate(-28deg) scale(0.9); }
          to { opacity: 1; transform: rotate(0) scale(1); }
        }
        .cg-score-ring { animation: cg-score-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .cg-console-enter, .cg-score-ring { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

export default DashboardConsole;
