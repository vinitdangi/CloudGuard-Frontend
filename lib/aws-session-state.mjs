/** @typedef {import("./aws-session-state.mjs").AwsConnectionState} AwsConnectionState */

/**
 * @param {string} [region]
 * @returns {AwsConnectionState}
 */
export function createAwsConnectionState(region = "us-east-1") {
  return {
    status: "not-connected",
    region,
    useEnvironmentCredentials: false,
    accessKeyId: "",
    secretAccessKey: "",
    accountId: null,
    verifiedRegion: null,
  };
}

/**
 * @param {AwsConnectionState} current
 * @param {Partial<AwsConnectionState>} changes
 * @returns {AwsConnectionState}
 */
export function updateAwsConnectionState(current, changes) {
  const credentialsOrRegionChanged = [
    "region",
    "useEnvironmentCredentials",
    "accessKeyId",
    "secretAccessKey",
  ].some((key) => Object.hasOwn(changes, key) && changes[key] !== current[key]);

  return {
    ...current,
    ...changes,
    ...(credentialsOrRegionChanged
      ? { status: "not-connected", accountId: null, verifiedRegion: null }
      : {}),
  };
}

/**
 * @param {AwsConnectionState} current
 * @param {{ connected: boolean, account_id?: string | null, region?: string | null }} result
 * @returns {AwsConnectionState}
 */
export function completeAwsConnectionTest(current, result) {
  return {
    ...current,
    status: result.connected ? "connected" : "failed",
    accountId: result.account_id ?? null,
    verifiedRegion: result.region ?? null,
  };
}

/** @param {AwsConnectionState} state */
export function canRunAwsScan(state) {
  return state.useEnvironmentCredentials || state.status === "connected";
}
