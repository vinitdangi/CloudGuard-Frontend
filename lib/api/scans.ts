import { isApiEndpointConfigured, requestApi } from "@/lib/api/client";
import {
  EMPTY_DASHBOARD,
  type DashboardFinding,
  type DashboardSnapshot,
  type FindingSeverity,
} from "@/lib/dashboard-data";
import { getScanHistory } from "@/lib/api/history";
import type {
  BackendSecurityScanResponse,
  LatestScanResponse,
  ScanHistoryResponse,
  SecurityScanRequest,
  SecurityScanResponse,
} from "@/lib/api/types";

export const DASHBOARD_DATA_KEY = "cloudguard:dashboard-data";

export async function runSecurityScan(
  request: SecurityScanRequest,
): Promise<SecurityScanResponse> {
  const response = await requestApi("runSecurityScan", {
    body: request,
  });

  const passedChecks = response.security_score.passed_count;
  const totalFindings = response.security_score.total_findings;
  const failedChecks = totalFindings - passedChecks;

  const findings: DashboardFinding[] = response.findings
    .filter((finding) => !finding.passed)
    .map((finding, index) => ({
      id: finding.finding_id ?? `${finding.check}-${index}`,
      severity: (
        finding.severity === "CRITICAL"
          ? "Critical"
          : finding.severity === "HIGH"
            ? "High"
            : finding.severity === "MEDIUM"
              ? "Medium"
              : "Low"
      ) as FindingSeverity,
      name: finding.check,
      resource: finding.resource,
      category: finding.category,
      description: finding.issue,
      recommendation: finding.recommendation,
    }));

  const severityCounts = {
    Critical: response.security_score.critical_count,
    High: response.security_score.high_count,
    Medium: response.security_score.medium_count,
    Low: response.security_score.low_count,
  };

  return {
    backendResponse: response,
    scan: {
      id: response.scan_timestamp,
      dateTime: response.scan_timestamp,
      account: response.aws_account_id,
      region: response.aws_region,
      securityScore: response.security_score.score,
      rating: response.security_score.rating,
      findingCount: totalFindings,
      status: "Completed",
    },
    score: {
      value: response.security_score.score,
      rating: response.security_score.rating,
    },
    findings,
    summary: {
      totalFindings,
      passedChecks,
      failedChecks,
      servicesChecked: 5,
    },
    severityCounts,
    durationSeconds: response.duration_seconds,
    metadata: response.metadata,
  };
}

export function getLatestScan(signal?: AbortSignal) {
  return requestApi("getLatestScan", { signal });
}

export function getFindings(signal?: AbortSignal) {
  return requestApi("getFindings", { signal });
}

export function getSecurityScore(signal?: AbortSignal) {
  return requestApi("getSecurityScore", { signal });
}

export interface DashboardDataResult {
  snapshot: DashboardSnapshot;
  errors: string[];
}

export const hasDashboardEndpointConfiguration = () =>
  isApiEndpointConfigured("getLatestScan") && isApiEndpointConfigured("getScanHistory");

export async function getDashboardData(signal?: AbortSignal): Promise<DashboardDataResult> {
  const results = await Promise.allSettled([
    getLatestScan(signal),
    getScanHistory(signal),
  ]);
  const latestResponse = fulfilledValue<LatestScanResponse>(results[0]);
  const history = fulfilledValue<ScanHistoryResponse>(results[1]);
  const errors = results.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "A CloudGuard dashboard request failed."]
    : []);

  if (!latestResponse && !history) {
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw failure?.reason ?? new Error("The CloudGuard API did not return dashboard data.");
  }

  const completeScan = latestResponse?.scan ?? null;
  const historyScan = history?.scans[0] ?? null;
  const severityCounts = completeScan
    ? {
        Critical: completeScan.security_score.critical_count,
        High: completeScan.security_score.high_count,
        Medium: completeScan.security_score.medium_count,
        Low: completeScan.security_score.low_count,
      }
    : historyScan?.severityCounts ?? null;
  const summary = completeScan
    ? {
        totalFindings: completeScan.security_score.total_findings,
        passedChecks: completeScan.security_score.passed_count,
        failedChecks: completeScan.security_score.total_findings - completeScan.security_score.passed_count,
        servicesChecked: 5,
      }
    : historyScan?.summary ?? null;

  return {
    snapshot: {
      ...EMPTY_DASHBOARD,
      account: completeScan?.aws_account_id ?? historyScan?.account ?? null,
      region: completeScan?.aws_region ?? historyScan?.region ?? null,
      lastScan: completeScan?.scan_timestamp ?? historyScan?.dateTime ?? null,
      score: completeScan
        ? { value: completeScan.security_score.score, rating: completeScan.security_score.rating }
        : historyScan
          ? { value: historyScan.securityScore, rating: historyScan.rating }
          : null,
      severityCounts,
      summary,
      findings: completeScan ? dashboardFindings(completeScan) : [],
      scans: history?.scans ?? (historyScan ? [historyScan] : []),
      hasCompleteScan: completeScan !== null,
      durationSeconds: completeScan?.duration_seconds ?? null,
      metadata: completeScan?.metadata ?? null,
    },
    errors,
  };
}

function dashboardFindings(response: BackendSecurityScanResponse): DashboardFinding[] {
  return response.findings
    .filter((finding) => !finding.passed)
    .map((finding, index) => ({
      id: finding.finding_id ?? `${finding.check}-${index}`,
      severity: finding.severity === "CRITICAL"
        ? "Critical"
        : finding.severity === "HIGH"
          ? "High"
          : finding.severity === "MEDIUM"
            ? "Medium"
            : "Low",
      name: finding.check,
      resource: finding.resource,
      category: finding.category,
      description: finding.issue,
      recommendation: finding.recommendation,
    }));
}

function fulfilledValue<T>(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? result.value as T : null;
}

export function dashboardDataWithScan(
  response: SecurityScanResponse,
  current: DashboardDataResult,
): DashboardDataResult {
  const previousScans = current.snapshot.scans.filter((scan) => scan.id !== response.scan.id);
  return {
    snapshot: {
      ...current.snapshot,
      account: response.scan.account,
      region: response.scan.region,
      lastScan: response.scan.dateTime,
      score: response.score,
      severityCounts: response.severityCounts,
      summary: response.summary,
      findings: response.findings,
      scans: [response.scan, ...previousScans],
      hasCompleteScan: true,
      durationSeconds: response.durationSeconds,
      metadata: response.metadata,
    },
    errors: current.errors,
  };
}


export type { SecurityScanRequest, SecurityScanResponse } from "@/lib/api/types";
