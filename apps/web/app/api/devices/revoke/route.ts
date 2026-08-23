import { NextResponse } from "next/server";
import { requireOwner } from "../../../../lib/auth";

export async function POST(request:Request){const body=await request.json().catch(()=>null) as {tokenId?:number}|null;if(!Number.isSafeInteger(body?.tokenId))return NextResponse.json({error:"invalid_body"},{status:400});const {client}=await requireOwner();const {data,error}=await client.rpc("revoke_device_token",{p_token_id:body!.tokenId});return error||!data?NextResponse.json({error:"not_found"},{status:404}):new NextResponse(null,{status:204});}
