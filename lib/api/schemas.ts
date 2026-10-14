import { z } from "zod";
import type { ApiEndpointName, EndpointResponseMap } from "@/lib/api/endpoints";

const ratingSchema = z.enum(["Excellent", "Good", "Needs Improvement", "Poor", "Critical"]);
const severitySchema = z.enum(["Critical", "High", "Medium", "Low"]);
const findingSchema = z.object({
  id: z.string(),
  severity: severitySchema,
  name: z.string(),
  resource: z.string(),
  category: z.string(),
  description: z.string(),
  recommendation: z.string(),
});
const scanSchema = z.object({
  id: z.string(),
  dateTime: z.string(),
  account: z.string(),
  region: z.string(),
  securityScore: z.number().finite(),
  rating: ratingSchema,
  findingCount: z.number().int().nonnegative(),
  status: z.enum(["Completed", "Failed", "In progress"]),
});
const summarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  passedChecks: z.number().int().nonnegative(),
  failedChecks: z.number().int().nonnegative(),
  servicesChecked: z.number().int().nonnegative(),
});
const severityCountsSchema = z.object({
  Critical: z.number().int().nonnegative(),
  High: z.number().int().nonnegative(),
  Medium: z.number().int().nonnegative(),
  Low: z.number().int().nonnegative(),
});
const securityScoreSchema = z.object({
  value: z.number().finite().min(0).max(100),
  rating: ratingSchema,
});
const backendUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  created_at: z.string(),
});

const backendFindingSchema = z.object({
  finding_id: z.string().nullable(),
  risk_score: z.number().finite(),
  impact: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  check: z.string(),
  category: z.string(),
  resource: z.string(),
  passed: z.boolean(),
  severity: z.string(),
  issue: z.string(),
  recommendation: z.string(),
  remediation: z.string(),
  compliance: z.array(z.unknown()),
});
const backendSecurityScoreSchema = z.object({
  score: z.number().finite().min(0).max(100),
  rating: ratingSchema,
  total_findings: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  critical_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
  severity_weights: z.record(z.string(), z.number()),
  penalty_breakdown: z.record(z.string(), z.number()),
  total_penalty: z.number(),
  maximum_penalty: z.number(),
  severity_summary: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
  }),
});
const backendSecurityScanSchema = z.object({
  scan_timestamp: z.string(),
  aws_account_id: z.string(),
  aws_region: z.string(),
  duration_seconds: z.number().finite(),
  metadata: z.record(z.string(), z.unknown()),
  security_score: backendSecurityScoreSchema,
  findings: z.array(backendFindingSchema),
});

export const API_RESPONSE_SCHEMAS = {
  login: backendUserSchema,
  signup: backendUserSchema,
  logout: z.object({ loggedOut: z.boolean() }),
  getCurrentUser: backendUserSchema,
  testAwsConnection: z.object({
    connected: z.boolean(),
    account_id: z.string().nullable(),
    region: z.string(),
    message: z.string().optional(),
  }),
  runSecurityScan: backendSecurityScanSchema,
  getLatestScan: z.object({
    scan: backendSecurityScanSchema.nullable(),
  }),
  getFindings: z.object({ findings: z.array(findingSchema) }),
  getSecurityScore: z.object({
    score: securityScoreSchema.nullable(),
    lastScan: z.string().nullable(),
  }),
  getScanHistory: z.object({
    scans: z.array(
      z.object({
        id: z.number(),
        scan_timestamp: z.string(),
        aws_account_id: z.string(),
        aws_region: z.string(),
        security_score: z.number().finite(),
        total_findings: z.number().int().nonnegative(),
        critical_count: z.number().int().nonnegative(),
        high_count: z.number().int().nonnegative(),
        medium_count: z.number().int().nonnegative(),
        low_count: z.number().int().nonnegative(),
        passed_count: z.number().int().nonnegative(),
      }),
    ),
  }),
  downloadJsonReport: backendSecurityScanSchema,
} satisfies Partial<Record<Exclude<ApiEndpointName, "downloadPdfReport">, z.ZodTypeAny>>;

export function parseApiResponse<Name extends Exclude<ApiEndpointName, "downloadPdfReport">>(
  endpoint: Name,
  value: unknown,
): EndpointResponseMap[Name] {
  return API_RESPONSE_SCHEMAS[endpoint].parse(value) as EndpointResponseMap[Name];
}
