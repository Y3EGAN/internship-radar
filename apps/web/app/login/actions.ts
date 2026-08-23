"use server";
import { redirect } from "next/navigation";
import { createDashboardClient } from "../../lib/auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const client = await createDashboardClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  redirect("/");
}

export async function signInWithGitHub() {
  const client = await createDashboardClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}
