import { requestApi } from "@/lib/api/client";
import type { ScanHistoryResponse } from "@/lib/api/types";
import { IMPLEMENTED_AWS_CHECKS, type DashboardScan } from "@/lib/dashboard-data";

interface BackendScanHistory {
  id: number;
  scan_timestamp: string;
  aws_account_id: string;
  aws_region: string;
  security_score: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  passed_count: number;
}

export async function getScanHistory(
  signal?: AbortSignal,
): Promise<ScanHistoryResponse> {
  const response = await requestApi("getScanHistory", { signal }) as unknown as {
    scans: BackendScanHistory[];
  };

  const scans: DashboardScan[] = response.scans.map((scan): DashboardScan => ({
    id: String(scan.id),
    dateTime: scan.scan_timestamp,
    account: scan.aws_account_id,
    region: scan.aws_region,
    securityScore: scan.security_score,
    rating:
      scan.security_score >= 90
        ? "Excellent"
        : scan.security_score >= 75
          ? "Good"
          : scan.security_score >= 60
            ? "Needs Improvement"
            : scan.security_score >= 40
              ? "Poor"
              : "Critical",
    findingCount: scan.total_findings,
    status: "Completed",
    severityCounts: {
      Critical: scan.critical_count,
      High: scan.high_count,
      Medium: scan.medium_count,
      Low: scan.low_count,
    },
    summary: {
      totalFindings: scan.total_findings,
      passedChecks: scan.passed_count,
      failedChecks: scan.critical_count + scan.high_count + scan.medium_count + scan.low_count,
      servicesChecked: IMPLEMENTED_AWS_CHECKS.length,
    },
  })).sort((first, second) =>
    Date.parse(second.dateTime) - Date.parse(first.dateTime),
  );

  return { scans };
}

export type { ScanHistoryResponse } from "@/lib/api/types";
