export type CloudGuardRating =
  | "Excellent"
  | "Good"
  | "Needs Improvement"
  | "Poor"
  | "Critical";

export type FindingSeverity = "Critical" | "High" | "Medium" | "Low";

export interface DashboardFinding {
  id: string;
  severity: FindingSeverity;
  name: string;
  resource: string;
  category: string;
  description: string;
  recommendation: string;
}

export interface DashboardScan {
  id: string;
  dateTime: string;
  account: string;
  region: string;
  securityScore: number;
  rating: CloudGuardRating;
  findingCount: number;
  status: "Completed" | "Failed" | "In progress";
  severityCounts?: Record<FindingSeverity, number>;
  summary?: {
    totalFindings: number;
    passedChecks: number;
    failedChecks: number;
    servicesChecked: number;
  };
}

export interface DashboardSnapshot {
  account: string | null;
  region: string | null;
  lastScan: string | null;
  score: {
    value: number;
    rating: CloudGuardRating;
  } | null;
  severityCounts: Record<FindingSeverity, number> | null;
  summary: {
    totalFindings: number;
    passedChecks: number;
    failedChecks: number;
    servicesChecked: number;
  } | null;
  findings: DashboardFinding[];
  scans: DashboardScan[];
  hasCompleteScan: boolean;
  durationSeconds: number | null;
  metadata: Record<string, unknown> | null;
}

export const IMPLEMENTED_AWS_CHECKS = [
  { name: "IAM", detail: "Identity & access" },
  { name: "S3", detail: "Storage security" },
  { name: "Security Groups", detail: "Network access" },
  { name: "Network ACLs", detail: "Subnet controls" },
  { name: "CloudTrail", detail: "Audit logging" },
] as const;

export const EMPTY_DASHBOARD: DashboardSnapshot = {
  account: null,
  region: null,
  lastScan: null,
  score: null,
  severityCounts: null,
  summary: null,
  findings: [],
  scans: [],
  hasCompleteScan: false,
  durationSeconds: null,
  metadata: null,
};
