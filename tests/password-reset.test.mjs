import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("forgot-password route renders the shared recovery form", async () => {
  const route = await read("../app/forgot-password/page.tsx");
  const component = await read("../components/auth/password-reset-page.tsx");

  assert.match(route, /PasswordResetPage mode="forgot"/);
  assert.match(component, /label="Email or username"/);
  assert.match(component, /Send reset link/);
  assert.match(component, /Back to Sign In/);
});

test("forgot-password submission sends identifier and displays the generic backend message", async () => {
  const component = await read("../components/auth/password-reset-page.tsx");
  const authApi = await read("../lib/api/auth.ts");
  const endpoints = await read("../lib/api/endpoints.ts");

  assert.match(component, /forgotPassword\(\{ identifier: identifier\.trim\(\) \}\)/);
  assert.match(component, /message: response\.message/);
  assert.match(authApi, /requestApi\("forgotPassword", \{ body: request \}\)/);
  assert.match(endpoints, /path: "\/api\/auth\/forgot-password"/);
});

test("reset-password route renders password fields and reads its query token", async () => {
  const route = await read("../app/reset-password/page.tsx");
  const component = await read("../components/auth/password-reset-page.tsx");

  assert.match(route, /PasswordResetPage mode="reset"/);
  assert.match(component, /label="New password"/);
  assert.match(component, /label="Confirm password"/);
  assert.match(component, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(component, /params\.get\("token"\)/);
});

test("successful reset posts token and both password fields without authenticating", async () => {
  const component = await read("../components/auth/password-reset-page.tsx");
  const authApi = await read("../lib/api/auth.ts");
  const endpoints = await read("../lib/api/endpoints.ts");

  assert.match(component, /resetPassword\(\{ token, password, confirmation \}\)/);
  assert.match(component, /setFeedback\(\{ kind: "success", message: response\.message \}\)/);
  assert.match(component, /message: apiErrorMessage\(error, "The password could not be reset/);
  assert.match(authApi, /requestApi\("resetPassword", \{ body: request \}\)/);
  assert.match(endpoints, /path: "\/api\/auth\/reset-password"/);
  assert.doesNotMatch(component, /establishAuthenticatedSession|localStorage|sessionStorage/);
});

test("password mismatch and weak password stop before the reset API call", async () => {
  const component = await read("../components/auth/password-reset-page.tsx");
  const mismatchIndex = component.indexOf("if (password !== confirmation)");
  const requestIndex = component.indexOf("const response = await resetPassword");

  assert.match(component, /if \(password\.length < 8\)/);
  assert.match(component, /Your passwords do not match\./);
  assert.ok(mismatchIndex >= 0 && mismatchIndex < requestIndex);
});

test("missing, expired, reused, and API error states are presented to the user", async () => {
  const component = await read("../components/auth/password-reset-page.tsx");

  assert.match(component, /This reset link is missing a token/);
  assert.match(component, /Request a new link/);
  assert.match(component, /The link may have expired or already been used/);
  assert.match(component, /apiErrorMessage\(error/);
});
