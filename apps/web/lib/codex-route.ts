import { NextResponse } from "next/server";
import { isAuthorizedCodexRequest } from "./codex-auth";

export function rejectUnauthorizedCodex(request: Request) {
  return isAuthorizedCodexRequest(request.headers.get("authorization"), process.env.CODEX_PREPARATION_TOKEN)
    ? null
    : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
