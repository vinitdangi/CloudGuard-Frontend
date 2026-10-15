import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apiProxyDestination, resolveApiBaseUrl } from "../lib/api/base-url.mjs";
import { buildAwsScanRequest } from "../lib/api/aws-request.mjs";
import {
  canRunAwsScan,
  completeAwsConnectionTest,
  createAwsConnectionState,
  updateAwsConnectionState,
} from "../lib/aws-session-state.mjs";

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

test("AWS session survives scans and dashboard hash navigation, then clears on logout or reload", async () => {
  const credentials = {
    accessKeyId: "AKIAFAKEKEY000000000",
    secretAccessKey: "FAKESECRETKEYVALUE0000000000000000",
  };
  let connection = createAwsConnectionState("ap-southeast-2");
  connection = updateAwsConnectionState(connection, credentials);
  connection = updateAwsConnectionState(connection, { status: "testing" });
  connection = completeAwsConnectionTest(connection, {
    connected: true,
    account_id: "314900493217",
    region: "ap-southeast-2",
  });
  assert.equal(connection.status, "connected");
  assert.deepEqual(
    { accessKeyId: connection.accessKeyId, secretAccessKey: connection.secretAccessKey },
    credentials,
  );
  assert.equal(canRunAwsScan(connection), true);

  const testRequest = {
    auth_method: "Access Key",
    region: connection.region,
    access_key_id: connection.accessKeyId,
    secret_access_key: connection.secretAccessKey,
  };
  const scanRequest = buildAwsScanRequest({
    useEnvironmentCredentials: connection.useEnvironmentCredentials,
    region: connection.region,
    accessKeyId: connection.accessKeyId,
    secretAccessKey: connection.secretAccessKey,
  });
  const sentScanRequests = [];
  const runScan = async (request) => {
    sentScanRequests.push(request);
    return { scan: { status: "Completed" } };
  };
  await runScan(scanRequest);

  assert.deepEqual(testRequest, scanRequest);
  assert.equal(sentScanRequests[0].auth_method, "Access Key");
  assert.equal(sentScanRequests[0].region, "ap-southeast-2");
  assert.equal(sentScanRequests[0].access_key_id, credentials.accessKeyId);
  assert.equal(sentScanRequests[0].secret_access_key, credentials.secretAccessKey);

  const component = await readFile(new URL("../components/dashboard/security-scan-section.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/dashboard/dashboard-console.tsx", import.meta.url), "utf8");
  const testHandler = component.slice(
    component.indexOf("const testConnection = async () =>"),
    component.indexOf("const startSecurityScan = async () =>"),
  );
  const scanHandler = component.slice(
    component.indexOf("const startSecurityScan = async () =>"),
    component.indexOf("return (", component.indexOf("const startSecurityScan = async () =>")),
  );
  const logoutHandler = dashboard.slice(
    dashboard.indexOf("const handleLogout = async () =>"),
    dashboard.indexOf("const handleReportDownload = async () =>"),
  );
  assert.doesNotMatch(testHandler, /clearCredentialFields/);
  assert.doesNotMatch(scanHandler, /clearCredentialFields|clearAwsConnection/);
  assert.match(logoutHandler, /clearAwsConnection\(\)/);
  assert.ok(logoutHandler.indexOf("clearAwsConnection()") < logoutHandler.indexOf("await logout()"));
  assert.match(dashboard, /useState<AwsConnectionState>/);
  assert.match(dashboard, /updateAwsConnectionState\(current, changes\)/);
  assert.match(component, /connection\.accessKeyId/);
  assert.match(component, /connection\.secretAccessKey/);
  assert.doesNotMatch(component, /const \[(accessKeyId|secretAccessKey),/);
  assert.doesNotMatch(component, /setLocalConnectionState/);
  assert.match(component, /id="settings"/);
  assert.match(component, /runSecurityScan\(buildAwsScanRequest\(/);
  assert.match(component, /disabled=\{scanInProgress \|\| !canRunAwsScan\(connection\)\}/);

  const navigationEffect = dashboard.slice(
    dashboard.indexOf("const syncActiveSection = () =>"),
    dashboard.indexOf("const hasLiveScore ="),
  );
  assert.match(dashboard, /href: "\/dashboard#security-scan"/);
  assert.match(dashboard, /href: "\/dashboard#scan-history"/);
  assert.match(dashboard, /href: "\/dashboard#overview"/);
  assert.match(dashboard, /href: "\/dashboard#aws-configuration"/);
  assert.match(dashboard, /href: "\/dashboard#settings"/);
  assert.doesNotMatch(navigationEffect, /setAwsConnection|clearAwsConnection/);
  assert.doesNotMatch(`${dashboard}\n${component}`, /localStorage|sessionStorage|indexedDB|document\.cookie/);

  for (const hash of ["#scan-history", "#overview", "#aws-configuration", "#settings", "#security-scan"]) {
    assert.ok(hash.startsWith("#"));
    assert.equal(connection.status, "connected");
    assert.equal(connection.accessKeyId, credentials.accessKeyId);
    assert.equal(connection.secretAccessKey, credentials.secretAccessKey);
    assert.equal(connection.accountId, "314900493217");
    assert.equal(connection.verifiedRegion, "ap-southeast-2");
  }

  const secondScanRequest = buildAwsScanRequest({
    useEnvironmentCredentials: connection.useEnvironmentCredentials,
    region: connection.region,
    accessKeyId: connection.accessKeyId,
    secretAccessKey: connection.secretAccessKey,
  });
  assert.deepEqual(await runScan(secondScanRequest), { scan: { status: "Completed" } });
  assert.deepEqual(sentScanRequests[1], sentScanRequests[0]);

  connection = createAwsConnectionState();
  assert.equal(connection.accessKeyId, "");
  assert.equal(connection.secretAccessKey, "");
  assert.equal(connection.status, "not-connected");
  const reloadedConnection = createAwsConnectionState();
  assert.equal(reloadedConnection.accessKeyId, "");
  assert.equal(reloadedConnection.secretAccessKey, "");
});

test("changing AWS region or credentials invalidates connection verification", () => {
  const verified = completeAwsConnectionTest(
    updateAwsConnectionState(
      updateAwsConnectionState(createAwsConnectionState("ap-southeast-2"), {
        accessKeyId: "AKIAFAKEKEY000000000",
        secretAccessKey: "FAKESECRETKEYVALUE0000000000000000",
      }),
      { status: "testing" },
    ),
    { connected: true, account_id: "314900493217", region: "ap-southeast-2" },
  );

  assert.equal(canRunAwsScan(verified), true);
  assert.equal(canRunAwsScan(updateAwsConnectionState(verified, { region: "ap-southeast-1" })), false);
  assert.equal(canRunAwsScan(updateAwsConnectionState(verified, { accessKeyId: "AKIAOTHER0000000000" })), false);
  assert.equal(canRunAwsScan(updateAwsConnectionState(verified, { secretAccessKey: "OTHERFAKESECRET0000000000000000" })), false);

  const environmentCredentials = updateAwsConnectionState(verified, { useEnvironmentCredentials: true });
  assert.equal(canRunAwsScan(environmentCredentials), true);
});
