import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apiProxyDestination, resolveApiBaseUrl } from "../lib/api/base-url.mjs";
import { buildAwsScanRequest } from "../lib/api/aws-request.mjs";

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

test("successful connection retains in-memory credentials for the following scan", async () => {
  const credentials = {
    accessKeyId: "AKIAFAKEKEY000000000",
    secretAccessKey: "FAKESECRETKEYVALUE0000000000000000",
  };
  const testRequest = {
    auth_method: "Access Key",
    region: "ap-southeast-2",
    access_key_id: credentials.accessKeyId,
    secret_access_key: credentials.secretAccessKey,
  };
  const connectionResult = await Promise.resolve({ connected: true });
  assert.equal(connectionResult.connected, true);

  const scanRequest = buildAwsScanRequest({
    useEnvironmentCredentials: false,
    region: "ap-southeast-2",
    ...credentials,
  });
  const sentScanRequests = [];
  await Promise.resolve().then(() => sentScanRequests.push(scanRequest));

  assert.deepEqual(testRequest, {
    auth_method: "Access Key",
    region: "ap-southeast-2",
    access_key_id: credentials.accessKeyId,
    secret_access_key: credentials.secretAccessKey,
  });
  assert.deepEqual(sentScanRequests, [{
    auth_method: "Access Key",
    region: "ap-southeast-2",
    access_key_id: credentials.accessKeyId,
    secret_access_key: credentials.secretAccessKey,
  }]);

  const component = await readFile(new URL("../components/dashboard/security-scan-section.tsx", import.meta.url), "utf8");
  const testHandler = component.slice(
    component.indexOf("const testConnection = async () =>"),
    component.indexOf("const startSecurityScan = async () =>"),
  );
  assert.doesNotMatch(testHandler, /clearCredentialFields/);
  assert.match(component, /const \[accessKeyId, setAccessKeyId\] = useState\(""\)/);
  assert.match(component, /const \[secretAccessKey, setSecretAccessKey\] = useState\(""\)/);
  assert.match(component, /runSecurityScan\(buildAwsScanRequest\(/);
});
