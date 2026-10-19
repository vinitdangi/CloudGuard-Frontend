import type {
  AwsConnectionTestRequest,
  BackendLoginRequest,
  BackendUser,
  BackendSignupRequest,
  AwsConnectionResponse,
  AuthResponse,
  SignupResponse,
  EmailVerificationRequest,
  ResendEmailVerificationRequest,
  EmailVerificationResponse,
  JsonReportResponse,
  LatestScanResponse,
  LoginRequest,
  LogoutResponse,
  PdfReportResponse,
  ScanHistoryResponse,
  SecurityScanRequest,
  SecurityScanResponse,
  BackendSecurityScanResponse,
  SecurityScoreResponse,
  FindingsResponse,
  SignupRequest,
} from "@/lib/api/types";

export type ApiEndpointName =
  | "login"
  | "signup"
  | "verifyEmail"
  | "resendEmailOtp"
  | "logout"
  | "getCurrentUser"
  | "testAwsConnection"
  | "runSecurityScan"
  | "getLatestScan"
  | "getFindings"
  | "getSecurityScore"
  | "getScanHistory"
  | "downloadPdfReport"
  | "downloadJsonReport";

export interface EndpointContract {
  method: "GET" | "POST";
  path: string | null;
  requestShape: string;
  responseShape: string;
}

/**
 * Route paths are intentionally unset until verified against the existing Python backend.
 * Do not guess a path: configure only confirmed routes here and retain the documented shapes.
 */
export const API_ENDPOINTS: Record<ApiEndpointName, EndpointContract> = {
  login: {
    method: "POST",
    path: "/api/auth/login",
    requestShape: "BackendLoginRequest { login, password }",
    responseShape: "BackendUser { id, username, email, created_at }",
  },
  signup: {
    method: "POST",
    path: "/api/auth/signup",
    requestShape: "SignupRequest { fullName, username, email, password }",
    responseShape: "SignupResponse { authenticated: false, email, message }; no session is created",
  },
  verifyEmail: {
    method: "POST",
    path: "/api/auth/verify-email",
    requestShape: "EmailVerificationRequest { email, otp }",
    responseShape: "EmailVerificationResponse { verified, message }",
  },
  resendEmailOtp: {
    method: "POST",
    path: "/api/auth/resend-otp",
    requestShape: "ResendEmailVerificationRequest { email }",
    responseShape: "EmailVerificationResponse { verified, message }",
  },
  logout: {
    method: "POST",
    path: "/api/auth/logout",
    requestShape: "No body; current cookie-backed session",
    responseShape: "HTTP 204 No Content",
  },
  getCurrentUser: {
    method: "GET",
    path: "/api/auth/me",
    requestShape: "No body; current cookie-backed session",
    responseShape: "BackendUser { id, username, email, created_at }",
  },
  testAwsConnection: {
    method: "POST",
    path: "/api/aws/test",
    requestShape: "AwsConnectionTestRequest { region, credentialSource, credentials? }",
    responseShape: "AwsConnectionResponse { connected, accountId, region, message? }",
  },
  runSecurityScan: {
    method: "POST",
    path: "/api/aws/scan",
    requestShape: "SecurityScanRequest { region, credentialSource: environment|provided, credentials? }",
    responseShape: "SecurityScanResponse { scan, score, findings, summary, severityCounts }",
  },
  getLatestScan: {
    method: "GET",
    path: "/api/aws/latest-scan",
    requestShape: "No body; authenticated session cookie",
    responseShape: "LatestScanResponse { scan: complete scan result | null }",
  },
  getFindings: {
    method: "GET",
    path: null,
    requestShape: "No body",
    responseShape: "FindingsResponse { findings: DashboardFinding[] }",
  },
  getSecurityScore: {
    method: "GET",
    path: null,
    requestShape: "No body",
    responseShape: "SecurityScoreResponse { score, lastScan }",
  },
  getScanHistory: {
    method: "GET",
    path: "/api/aws/history",
    requestShape: "No body",
    responseShape: "ScanHistoryResponse { scans: DashboardScan[] }",
  },
  downloadPdfReport: {
    method: "GET",
    path: "/api/aws/latest-scan/pdf",
    requestShape: "No body; authenticated session cookie",
    responseShape: "application/pdf binary response",
  },
  downloadJsonReport: {
    method: "GET",
    path: "/api/aws/latest-scan/json",
    requestShape: "No body; authenticated session cookie",
    responseShape: "BackendSecurityScanResponse { complete persisted scan result }",
  },
};

export type EndpointResponse<Name extends ApiEndpointName> = Name extends "login"
  ? BackendUser
  : Name extends "signup"
    ? SignupResponse
    : Name extends "verifyEmail" | "resendEmailOtp"
      ? EmailVerificationResponse
      : Name extends "logout"
        ? LogoutResponse
    : Name extends "getCurrentUser"
      ? BackendUser
    : Name extends "testAwsConnection"
      ? AwsConnectionResponse
      : Name extends "runSecurityScan"
        ? BackendSecurityScanResponse
        : Name extends "getLatestScan"
          ? LatestScanResponse
          : Name extends "getFindings"
            ? FindingsResponse
            : Name extends "getSecurityScore"
              ? SecurityScoreResponse
              : Name extends "getScanHistory"
                ? ScanHistoryResponse
                : Name extends "downloadPdfReport"
                  ? PdfReportResponse
                  : Name extends "downloadJsonReport"
                    ? JsonReportResponse
                    : never;

export type EndpointRequest<Name extends ApiEndpointName> = Name extends "login"
  ? LoginRequest
  : Name extends "signup"
    ? SignupRequest
    : Name extends "verifyEmail"
      ? EmailVerificationRequest
      : Name extends "resendEmailOtp"
        ? ResendEmailVerificationRequest
        : Name extends "testAwsConnection"
      ? AwsConnectionTestRequest
      : Name extends "runSecurityScan"
        ? SecurityScanRequest
        : never;

export type { AuthResponse, AwsConnectionResponse, JsonReportResponse, LatestScanResponse, ScanHistoryResponse, SecurityScanResponse, SecurityScoreResponse };
export type { FindingsResponse, LogoutResponse, PdfReportResponse };

// Keep the contract models imported above visible to TypeScript for endpoint documentation.
export type EndpointContractModels = {
  login: BackendLoginRequest;
signup: BackendSignupRequest;
  awsConnection: AwsConnectionTestRequest;
  scan: SecurityScanRequest;
};

// Request and response interfaces above are the source of truth for each shape.
export type EndpointModelName = keyof EndpointContractModels;

// Compile-time pairing prevents endpoint additions from silently omitting a model.
export type EndpointRequestMap = {
  login: BackendLoginRequest;
  signup: BackendSignupRequest;
  verifyEmail: EmailVerificationRequest;
  resendEmailOtp: ResendEmailVerificationRequest;
  logout: undefined;
  getCurrentUser: undefined;
  testAwsConnection: AwsConnectionTestRequest;
  runSecurityScan: SecurityScanRequest;
  getLatestScan: undefined;
  getFindings: undefined;
  getSecurityScore: undefined;
  getScanHistory: undefined;
  downloadPdfReport: undefined;
  downloadJsonReport: undefined;
};

export type EndpointResponseMap = {
  login: BackendUser;
  signup: SignupResponse;
  verifyEmail: EmailVerificationResponse;
  resendEmailOtp: EmailVerificationResponse;
  logout: LogoutResponse;
  getCurrentUser: BackendUser;
  testAwsConnection: AwsConnectionResponse;
  runSecurityScan: BackendSecurityScanResponse;
  getLatestScan: LatestScanResponse;
  getFindings: FindingsResponse;
  getSecurityScore: SecurityScoreResponse;
  getScanHistory: ScanHistoryResponse;
  downloadPdfReport: PdfReportResponse;
  downloadJsonReport: JsonReportResponse;
};

export type { ApiEndpointName as ApiEndpoint };

export const API_BASE_URL_ENV = "NEXT_PUBLIC_API_BASE_URL" as const;

export const API_ENDPOINT_ENV_GUIDANCE =
  "Set NEXT_PUBLIC_API_BASE_URL to the existing CloudGuard Python API origin; production deployments must use HTTPS.";

export const endpointTypes: Pick<EndpointContract, "method" | "requestShape" | "responseShape"> = {
  method: "GET",
  requestShape: "Typed in lib/api/types.ts",
  responseShape: "Typed in lib/api/types.ts",
};

export type EndpointFor<Name extends ApiEndpointName> = EndpointRequestMap[Name] extends undefined
  ? EndpointContract
  : EndpointContract & { request: EndpointRequestMap[Name]; response: EndpointResponseMap[Name] };

export type EndpointRouteSettings = Partial<Record<ApiEndpointName, string>>;

export type ApiEndpointDocs = {
  [Name in ApiEndpointName]: {
    method: EndpointContract["method"];
    requiredRoute: string;
    request: string;
    response: string;
  };
};

export const API_ENDPOINT_DOCUMENTATION: ApiEndpointDocs = Object.fromEntries(
  Object.entries(API_ENDPOINTS).map(([name, contract]) => [name, {
    method: contract.method,
    requiredRoute: "Confirm the exact path with the existing Python backend; path is intentionally unset.",
    request: contract.requestShape,
    response: contract.responseShape,
  }]),
) as ApiEndpointDocs;
