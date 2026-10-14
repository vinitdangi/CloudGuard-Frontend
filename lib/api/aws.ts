import { requestApi } from "@/lib/api/client";
import type {
  AwsConnectionTestRequest,
  AwsConnectionResponse,
} from "@/lib/api/types";

/** Credentials are sent only to the explicitly configured CloudGuard API origin. */
export async function testAwsConnection(
  request: AwsConnectionTestRequest,
): Promise<AwsConnectionResponse> {
  const response = await requestApi("testAwsConnection", { body: request }) as unknown as {
    connected: boolean;
    account_id: string | null;
    region: string;
    message?: string;
  };

  return {
    connected: response.connected,
    account_id: response.account_id,
    region: response.region,
    message: response.message,
  };
}

export type { AwsConnectionTestRequest, AwsConnectionResponse } from "@/lib/api/types";
