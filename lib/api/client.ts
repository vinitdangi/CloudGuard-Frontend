import { ZodError } from "zod";
import { resolveApiBaseUrl } from "@/lib/api/base-url.mjs";
import {
  API_BASE_URL_ENV,
  API_ENDPOINTS,
  type ApiEndpointName,
  type EndpointRequestMap,
  type EndpointResponseMap,
} from "@/lib/api/endpoints";
import { parseApiResponse } from "@/lib/api/schemas";

export type ApiErrorCode =
  | "configuration"
  | "authentication"
  | "aws"
  | "scan"
  | "network"
  | "http"
  | "response";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function baseUrl() {
  return resolveApiBaseUrl({
    isProduction: process.env.NODE_ENV === "production",
    browserOrigin: typeof window === "undefined" ? undefined : window.location.origin,
    configuredBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}

export function isApiEndpointConfigured(name: ApiEndpointName) {
  try {
    endpointUrl(name);
    return true;
  } catch {
    return false;
  }
}

function endpointUrl(name: ApiEndpointName) {
  const configuredBaseUrl = baseUrl();
  const path = API_ENDPOINTS[name].path;

  if (!configuredBaseUrl) {
    throw new ApiError(
      `${API_BASE_URL_ENV} is not set. Configure the existing CloudGuard API origin before making requests.`,
      "configuration",
    );
  }

  if (!path) {
    throw new ApiError(
      `The ${name} endpoint path is intentionally unconfigured. Confirm the exact route with the existing Python backend before enabling this action.`,
      "configuration",
    );
  }

  let url: URL;
  try {
    url = new URL(configuredBaseUrl);
  } catch {
    throw new ApiError(`${API_BASE_URL_ENV} must be an absolute API origin.`, "configuration");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ApiError(`${API_BASE_URL_ENV} must use HTTP or HTTPS.`, "configuration");
  }
  if (url.username || url.password) {
    throw new ApiError(`${API_BASE_URL_ENV} must not contain embedded credentials.`, "configuration");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new ApiError("The CloudGuard API must use HTTPS in production.", "configuration");
  }

  const endpoint = new URL(path, url.href.endsWith("/") ? url : `${url.href}/`);
  if (endpoint.origin !== url.origin) {
    throw new ApiError("CloudGuard endpoint paths must remain on the configured API origin.", "configuration");
  }
  return endpoint.toString();
}

function requestErrorCode(name: ApiEndpointName, status?: number): ApiErrorCode {
  if (status === 401 || status === 403) return "authentication";
  if (name === "testAwsConnection") return "aws";
  if (name === "runSecurityScan") return "scan";
  return "http";
}

async function responseError(response: Response, name: ApiEndpointName) {
  const body = await response.text().catch(() => "");
  let message: string | undefined;
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as Record<string, unknown>;
        if (typeof record.message === "string") message = record.message;
        else if (typeof record.detail === "string") message = record.detail;
        else if (typeof record.error === "string") message = record.error;
      }
    } catch {
      // Non-JSON error bodies are not exposed to the UI.
    }
  }

  const fallback = response.status === 401 || response.status === 403
    ? "Your session is missing or expired. Sign in and try again."
    : name === "testAwsConnection"
      ? "The AWS connection test failed. Check the configured AWS access and permissions."
      : name === "runSecurityScan"
        ? "The CloudGuard scan request failed. No successful scan result was returned."
        : `The CloudGuard API request failed (${response.status}).`;

  return new ApiError(message ?? fallback, requestErrorCode(name, response.status), response.status);
}

async function fetchEndpoint(name: ApiEndpointName, body?: unknown, signal?: AbortSignal) {
  const url = endpointUrl(name);
  const method = API_ENDPOINTS[name].method;
  if (body !== undefined && method !== "POST") {
    throw new ApiError(`The ${name} endpoint does not accept a request body.`, "configuration");
  }

  try {
    const response = await fetch(url, {
      method,
      credentials: "include",
      cache: "no-store",
      signal,
      headers: {
        Accept: name === "downloadPdfReport" ? "application/pdf" : "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw await responseError(response, name);
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the configured CloudGuard API.", "network");
  }
}

export async function requestApi<Name extends Exclude<ApiEndpointName, "downloadPdfReport">>(
  name: Name,
  options: { body?: EndpointRequestMap[Name]; signal?: AbortSignal } = {},
): Promise<EndpointResponseMap[Name]> {
  const response = await fetchEndpoint(name, options.body, options.signal);
  if (name === "logout" && response.status === 204) {
    return { loggedOut: true } as EndpointResponseMap[Name];
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The CloudGuard API returned an unreadable JSON response.", "response", response.status);
  }

  try {
    return parseApiResponse(name, payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        "The CloudGuard API response did not match the documented response contract.",
        "response",
        response.status,
      );
    }
    throw error;
  }
}

export async function requestPdfReport(signal?: AbortSignal): Promise<Blob> {
  const response = await fetchEndpoint("downloadPdfReport", undefined, signal);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new ApiError("The CloudGuard API did not return a PDF report.", "response", response.status);
  }
  return response.blob();
}

export function apiConfigurationMessage(name: ApiEndpointName) {
  try {
    endpointUrl(name);
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.message : "CloudGuard API configuration is incomplete.";
  }
}

export function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export const API_BASE_URL_CONFIGURATION =
  "Set NEXT_PUBLIC_API_BASE_URL to the existing CloudGuard API origin. Add confirmed endpoint paths in lib/api/endpoints.ts; no paths are guessed.";

export type ApiRequest<Name extends ApiEndpointName> = EndpointRequestMap[Name];
export type ApiResponse<Name extends ApiEndpointName> = EndpointResponseMap[Name];
