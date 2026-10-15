import assert from "node:assert/strict";
import test from "node:test";
import { apiProxyDestination, resolveApiBaseUrl } from "../lib/api/base-url.mjs";

test("production browser API calls use the current Vercel origin", () => {
  assert.equal(resolveApiBaseUrl({
    isProduction: true,
    browserOrigin: "https://cloud-guard-frontend-five.vercel.app",
    configuredBaseUrl: "https://cloudguard-production-9db9.up.railway.app",
  }), "https://cloud-guard-frontend-five.vercel.app");
});

test("Next proxies same-origin API paths to the configured Railway backend", () => {
  assert.deepEqual(apiProxyDestination("https://cloudguard-production-9db9.up.railway.app/"), [
    {
      source: "/api/:path*",
      destination: "https://cloudguard-production-9db9.up.railway.app/api/:path*",
    },
  ]);
});

test("localhost development retains the configured API origin", () => {
  assert.equal(resolveApiBaseUrl({
    isProduction: false,
    browserOrigin: "http://localhost:3000",
    configuredBaseUrl: "http://localhost:8000",
  }), "http://localhost:8000");
});

test("an unset API origin does not create a malformed rewrite", () => {
  assert.deepEqual(apiProxyDestination("  "), []);
});
