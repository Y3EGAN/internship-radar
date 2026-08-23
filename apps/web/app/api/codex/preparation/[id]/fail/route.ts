import { NextResponse } from "next/server";
import { rejectUnauthorizedCodex } from "../../../../../../lib/codex-route";
import { createServiceClient } from "../../../../../../lib/service-client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectUnauthorizedCodex(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as { questions?: unknown[]; errorCode?: string } | null;
  if (!body || !Array.isArray(body.questions)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const { id } = await params;
    const { error } = await createServiceClient().rpc("fail_application_preparation", { p_application_id: id, p_questions: body.questions, p_error_code: body.errorCode?.slice(0, 100) ?? null });
    return error ? NextResponse.json({ error: "state_transition_failed" }, { status: 409 }) : new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
