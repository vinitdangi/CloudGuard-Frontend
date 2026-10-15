import assert from "node:assert/strict";
import test from "node:test";
import { initCache, serialize } from "swr/_internal";
import {
  AUTH_SESSION_KEY,
  establishAuthenticatedSession,
  shouldRedirectToLogin,
} from "../lib/auth-session.mjs";

test("successful login replaces a cached auth failure before dashboard guard runs", async () => {
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

  await establishAuthenticatedSession(mutate, authenticatedResponse);

  const authState = cache.get(cacheKey);
  assert.equal(authState?.data, authenticatedResponse);
  assert.equal(authState?.error, undefined);
  assert.equal(shouldRedirectToLogin(false, authState?.error), false);
});

test("dashboard guard redirects only for a settled authentication error", () => {
  const authError = Object.assign(new Error("Session missing"), { code: "authentication" });

  assert.equal(shouldRedirectToLogin(true, authError), false);
  assert.equal(shouldRedirectToLogin(false, authError), true);
  assert.equal(shouldRedirectToLogin(false, new Error("Network unavailable")), false);
});
