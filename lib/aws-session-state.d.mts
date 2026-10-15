export type AwsConnectionStatus = "not-connected" | "testing" | "connected" | "failed";

export type AwsConnectionState = {
  status: AwsConnectionStatus;
  region: string;
  useEnvironmentCredentials: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string | null;
  verifiedRegion: string | null;
};

export function createAwsConnectionState(region?: string): AwsConnectionState;
export function updateAwsConnectionState(
  current: AwsConnectionState,
  changes: Partial<AwsConnectionState>,
): AwsConnectionState;
export function completeAwsConnectionTest(
  current: AwsConnectionState,
  result: { connected: boolean; account_id?: string | null; region?: string | null },
): AwsConnectionState;
export function canRunAwsScan(state: AwsConnectionState): boolean;
