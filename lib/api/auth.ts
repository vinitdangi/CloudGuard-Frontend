import { requestApi } from "@/lib/api/client";
import type {
  AuthResponse,
  BackendLoginRequest,
  BackendSignupRequest,
  SignupResponse,
  EmailVerificationRequest,
  ResendEmailVerificationRequest,
  EmailVerificationResponse,
  LoginRequest,
  SignupRequest,
} from "@/lib/api/types";

interface BackendUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

function normalizeAuthResponse(user: BackendUser): AuthResponse {
  return {
    authenticated: true,
    user: {
      id: String(user.id),
      fullName: user.username,
      username: user.username,
      email: user.email,
    },
  };
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await requestApi("login", {
    body: {
      login: request.identifier,
      password: request.password,
    },
  });

  return normalizeAuthResponse(response);
}

export async function signup(request: SignupRequest): Promise<SignupResponse> {
  return requestApi("signup", {
    body: {
      username: request.username,
      email: request.email,
      password: request.password,
      confirmation: request.password,
    },
  });
}

export async function verifyEmail(request: EmailVerificationRequest): Promise<EmailVerificationResponse> {
  return requestApi("verifyEmail", { body: request });
}

export async function resendEmailOtp(request: ResendEmailVerificationRequest): Promise<EmailVerificationResponse> {
  return requestApi("resendEmailOtp", { body: request });
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await requestApi("getCurrentUser");
  return normalizeAuthResponse(response);
}

export async function logout() {
  return requestApi("logout");
}

export type { LoginRequest, SignupRequest } from "@/lib/api/types";
