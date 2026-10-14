import { requestApi } from "@/lib/api/client";
import type {
  AuthResponse,
  BackendLoginRequest,
  BackendSignupRequest,
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

export async function signup(request: SignupRequest): Promise<AuthResponse> {
  const response = await requestApi("signup", {
    body: {
      username: request.username,
      email: request.email,
      password: request.password,
      confirmation: request.password,
    },
  });

  return normalizeAuthResponse(response);
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await requestApi("getCurrentUser");
  return normalizeAuthResponse(response);
}

export async function logout() {
  return requestApi("logout");
}

export type { LoginRequest, SignupRequest } from "@/lib/api/types";
