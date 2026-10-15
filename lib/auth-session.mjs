/** @typedef {import("./api/types").AuthResponse} AuthResponse */

export const AUTH_SESSION_KEY = "cloudguard:auth-session";

let authSessionRevision = 0;
/** @type {AuthResponse | null} */
let committedAuthenticatedSession = null;

class StaleAuthSessionRequestError extends Error {
  constructor() {
    super("A stale authentication check was discarded.");
    this.name = "StaleAuthSessionRequestError";
    this.code = "stale_auth_session";
  }
}

/**
 * @param {(key: string, data: AuthResponse, options: { revalidate: false }) => Promise<unknown>} mutate
 * @param {AuthResponse} response
 * @param {() => void} navigateToDashboard
 */
export async function establishAuthenticatedSession(mutate, response, navigateToDashboard) {
  authSessionRevision += 1;
  committedAuthenticatedSession = response;
  await mutate(AUTH_SESSION_KEY, response, { revalidate: false });
  navigateToDashboard();
}

/** @param {() => Promise<AuthResponse>} fetchCurrentUser */
export async function fetchCurrentUserForSession(fetchCurrentUser) {
  const requestRevision = authSessionRevision;

  try {
    const response = await fetchCurrentUser();
    if (requestRevision !== authSessionRevision) {
      if (committedAuthenticatedSession) return committedAuthenticatedSession;
      throw new StaleAuthSessionRequestError();
    }
    if (response.authenticated) committedAuthenticatedSession = response;
    return response;
  } catch (error) {
    if (requestRevision !== authSessionRevision) {
      if (committedAuthenticatedSession) return committedAuthenticatedSession;
      throw new StaleAuthSessionRequestError();
    }
    throw error;
  }
}

export function clearAuthenticatedSession() {
  authSessionRevision += 1;
  committedAuthenticatedSession = null;
}

/**
 * @param {boolean} isLoading
 * @param {unknown} error
 */
export function shouldRedirectToLogin(isLoading, error) {
  return !isLoading
    && error instanceof Error
    && "code" in error
    && error.code === "authentication";
}
