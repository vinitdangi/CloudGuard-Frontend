import type {
  CloudGuardRating,
  DashboardFinding,
  DashboardScan,
  DashboardSnapshot,
  FindingSeverity,
} from "@/lib/dashboard-data";

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
}
export interface SignupResponse {
  authenticated: false;
  email: string;
  message: string;
}

export interface EmailVerificationRequest {
  email: string;
  otp: string;
}

export interface ResendEmailVerificationRequest {
  email: string;
}

export interface EmailVerificationResponse {
  verified: boolean;
  message: string;
}

export interface BackendUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface BackendLoginRequest {
  login: string;
  password: string;
}

export interface BackendSignupRequest {
  username: string;
  email: string;
  password: string;
  confirmation: string;
}
export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

/** Expected cookie-backed response; auth tokens must not be persisted in browser storage. */
export interface AuthResponse {
  authenticated: boolean;
  user: AuthUser;
  message?: string;
}

export interface LogoutResponse {
  loggedOut: boolean;
}

export interface AwsConnectionTestRequest {
  auth_method: "Access Key" | "Existing AWS Environment Credentials";
  region: string;
  access_key_id?: string;
  secret_access_key?: string;
}

export interface AwsConnectionResponse {
  connected: boolean;
  account_id: string | null;
  region: string;
  message?: string;
}

export interface SecurityScanRequest {
  auth_method: "Access Key" | "Existing AWS Environment Credentials";
  region: string;
  access_key_id?: string;
  secret_access_key?: string;
}

export interface SecurityScore {
  value: number;
  rating: CloudGuardRating;
}

export interface ScanSummary {
  totalFindings: number;
  passedChecks: number;
  failedChecks: number;
  servicesChecked: number;
}

export type SeverityCounts = Record<FindingSeverity, number>;

export interface BackendSecurityScanResponse {
  scan_timestamp: string;
  aws_account_id: string;
  aws_region: string;
  duration_seconds: number;
  metadata: Record<string, unknown>;
  security_score: {
    score: number;
    rating: CloudGuardRating;
    total_findings: number;
    passed_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    severity_weights: Record<string, number>;
    penalty_breakdown: Record<string, number>;
    total_penalty: number;
    maximum_penalty: number;
    severity_summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      passed: number;
    };
  };
  findings: BackendSecurityFinding[];
}

export interface BackendSecurityFinding {
  finding_id: string | null;
  risk_score: number;
  impact: string;
  evidence: Record<string, unknown>;
  check: string;
  category: string;
  resource: string;
  passed: boolean;
  severity: string;
  issue: string;
  recommendation: string;
  remediation: string;
  compliance: unknown[];
}

export interface SecurityScanResponse {
  scan: DashboardScan;
  score: SecurityScore;
  findings: DashboardFinding[];
  summary: ScanSummary;
  severityCounts: SeverityCounts;
  durationSeconds: number;
  metadata: Record<string, unknown>;
}

export interface LatestScanResponse {
  scan: BackendSecurityScanResponse | null;
}

export interface FindingsResponse {
  findings: DashboardFinding[];
}

export interface SecurityScoreResponse {
  score: SecurityScore | null;
  lastScan: string | null;
}

export interface ScanHistoryResponse {
  scans: DashboardScan[];
}

export type JsonReportResponse = BackendSecurityScanResponse;

export type DashboardApiSnapshot = DashboardSnapshot;

export type PdfReportResponse = Blob;
export type JsonReportBlob = Blob;
export type ReportFormat = "pdf" | "json";
export type ApiStatus = "idle" | "loading" | "success" | "error" | "empty";

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

export interface ApiStatusState {
  status: ApiStatus;
  error: string | null;
}

export type { FindingSeverity };
export type { CloudGuardRating };
export type { DashboardFinding, DashboardScan, DashboardSnapshot };
