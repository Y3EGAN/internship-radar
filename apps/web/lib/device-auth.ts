import { createServiceClient } from "./service-client";
import { credentialHash } from "./credential";

export async function authenticateDevice(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createServiceClient();
  const { data, error } = await client.rpc("authenticate_device_token", { p_token_hash: credentialHash(authorization.slice(7)) });
  return error || !data?.[0] ? null : { client, device: data[0], tokenHash: credentialHash(authorization.slice(7)) };
}
