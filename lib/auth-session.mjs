/** @typedef {import("./api/types").AuthResponse} AuthResponse */

export const AUTH_SESSION_KEY = "cloudguard:auth-session";

/**
 * @param {(key: string, data: AuthResponse, options: { revalidate: false }) => Promise<unknown>} mutate
 * @param {AuthResponse} response
 */
export function establishAuthenticatedSession(mutate, response) {
  return mutate(AUTH_SESSION_KEY, response, { revalidate: false });
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
