import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createDashboardClient } from "../../../../lib/auth";
import { credentialHash } from "../../../../lib/credential";
import { createServiceClient } from "../../../../lib/service-client";

export async function POST(request: Request) {
  const body = await request.json().catch(()=>null) as { operation?:"create"|"consume";deviceLabel?:string;pairingCode?:string }|null;
  if (!body?.operation) return NextResponse.json({error:"invalid_body"},{status:400});
  if (body.operation === "create") {
    const client = await createDashboardClient();
    const {data:{user}} = await client.auth.getUser();
    if (!user || user.id !== process.env.OWNER_USER_ID) return NextResponse.json({error:"unauthorized"},{status:401});
    const pairingCode = randomBytes(24).toString("base64url");
    const {error}=await client.rpc("create_device_pairing",{p_pairing_code_hash:credentialHash(pairingCode),p_device_label:body.deviceLabel?.trim().slice(0,100)||"Local companion"});
    return error?NextResponse.json({error:"pairing_failed"},{status:409}):NextResponse.json({pairingCode,expiresInSeconds:600},{status:201});
  }
  if (!body.pairingCode) return NextResponse.json({error:"invalid_body"},{status:400});
  const token=randomBytes(32).toString("base64url");
  const {data,error}=await createServiceClient().rpc("consume_device_pairing",{p_pairing_code_hash:credentialHash(body.pairingCode),p_token_hash:credentialHash(token)});
  return error||!data?.[0]?NextResponse.json({error:"invalid_or_expired_pairing"},{status:401}):NextResponse.json({token,device:data[0]},{status:201});
}
