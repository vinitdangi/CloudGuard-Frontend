import assert from "node:assert/strict";
import test from "node:test";
import { initCache, serialize } from "swr/_internal";
import {
  AUTH_SESSION_KEY,
  clearAuthenticatedSession,
  establishAuthenticatedSession,
  fetchCurrentUserForSession,
  shouldRedirectToLogin,
} from "../lib/auth-session.mjs";

test("successful login prevents a stale in-flight /me failure from replacing auth state", async () => {
  const initializedCache = initCache(new Map());
  assert.ok(initializedCache);
  const [cache, mutate] = initializedCache;
  const cacheKey = serialize(AUTH_SESSION_KEY)[0];
  const staleError = Object.assign(new Error("Session missing"), { code: "authentication" });
  const authenticatedResponse = {
    authenticated: true,
    user: {
      id: "1",
      fullName: "session_user",
      username: "session_user",
      email: "session@example.com",
    },
  };
  cache.set(cacheKey, {
    data: undefined,
    error: staleError,
    isValidating: false,
    isLoading: false,
  });

  let rejectStaleRequest;
  const staleMeRequest = fetchCurrentUserForSession(() => new Promise((_, reject) => {
    rejectStaleRequest = reject;
  }));

  let navigatedToDashboard = false;
  await establishAuthenticatedSession(mutate, authenticatedResponse, () => {
    assert.equal(cache.get(cacheKey)?.data, authenticatedResponse);
    navigatedToDashboard = true;
  });
  assert.equal(navigatedToDashboard, true);
  rejectStaleRequest(staleError);
  const staleMeResult = await staleMeRequest;
  await mutate(AUTH_SESSION_KEY, staleMeResult, { revalidate: false });

  const authState = cache.get(cacheKey);
  assert.equal(authState?.data, authenticatedResponse);
  assert.equal(authState?.error, undefined);
  assert.equal(shouldRedirectToLogin(false, authState?.error), false);
});

test("a new /me failure still invalidates auth, and logout clears committed state", async () => {
  const initializedCache = initCache(new Map());
  assert.ok(initializedCache);
  const [cache, mutate] = initializedCache;
  const cacheKey = serialize(AUTH_SESSION_KEY)[0];
  const authenticatedResponse = {
    authenticated: true,
    user: { id: "2", fullName: "operator", username: "operator", email: "operator@example.com" },
  };
  const authError = Object.assign(new Error("Session missing"), { code: "authentication" });
  await establishAuthenticatedSession(mutate, authenticatedResponse, () => undefined);

  await assert.rejects(
    fetchCurrentUserForSession(async () => { throw authError; }),
    (error) => error === authError,
  );

  let resolveStaleRequest;
  const staleRequest = fetchCurrentUserForSession(() => new Promise((resolve) => {
    resolveStaleRequest = resolve;
  }));
  clearAuthenticatedSession();
  await mutate(AUTH_SESSION_KEY, undefined, { revalidate: false });
  resolveStaleRequest(authenticatedResponse);

  await assert.rejects(staleRequest, { code: "stale_auth_session" });
  assert.equal(cache.get(cacheKey)?.data, undefined);
});

test("dashboard guard redirects only for a settled authentication error", () => {
  const authError = Object.assign(new Error("Session missing"), { code: "authentication" });

  assert.equal(shouldRedirectToLogin(true, authError), false);
  assert.equal(shouldRedirectToLogin(false, authError), true);
  assert.equal(shouldRedirectToLogin(false, new Error("Network unavailable")), false);
});
