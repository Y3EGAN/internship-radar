import { NextResponse } from "next/server";
import { rejectUnauthorizedCodex } from "../../../../../lib/codex-route";
import { createServiceClient } from "../../../../../lib/service-client";

export async function GET(request: Request) {
  const denied = rejectUnauthorizedCodex(request);
  if (denied) return denied;
  try {
    const workerId = request.headers.get("x-worker-id")?.trim().slice(0, 100) || "codex-heartbeat";
    const { data, error } = await createServiceClient().rpc("claim_next_application_preparation", { p_worker_id: workerId });
    if (error) return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    return data?.[0] ? NextResponse.json({ preparation: data[0] }) : new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
