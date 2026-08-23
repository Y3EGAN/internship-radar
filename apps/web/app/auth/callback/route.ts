import { NextResponse } from "next/server";
import { createDashboardClient } from "../../../lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", url));
  const client = await createDashboardClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login?error=oauth" : "/", url));
}
