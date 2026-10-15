/**
 * @param {{ useEnvironmentCredentials: boolean, region: string, accessKeyId?: string, secretAccessKey?: string }} input
 * @returns {{ auth_method: "Access Key" | "Existing AWS Environment Credentials", region: string, access_key_id?: string, secret_access_key?: string }}
 */
export function buildAwsScanRequest({
  useEnvironmentCredentials,
  region,
  accessKeyId,
  secretAccessKey,
}) {
  return {
    auth_method: useEnvironmentCredentials
      ? "Existing AWS Environment Credentials"
      : "Access Key",
    region,
    ...(!useEnvironmentCredentials
      ? { access_key_id: accessKeyId, secret_access_key: secretAccessKey }
      : {}),
  };
}
