import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardAccessDecision } from "./access";

export async function createDashboardClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.invalid",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "fixture-publishable-key",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(values) {
          try {
            for (const value of values) cookieStore.set(value.name, value.value, value.options);
          } catch {
            // Server Components cannot always persist refreshed cookies; proxy refresh handles deployed sessions.
          }
        },
      },
    },
  );
}

export async function requireOwner() {
  const client = await createDashboardClient();
  const { data: { user } } = await client.auth.getUser();
  const decision = dashboardAccessDecision(user?.id ?? null, process.env.OWNER_USER_ID ?? "00000000-0000-0000-0000-000000000000");
  if (decision === "anonymous") redirect("/login");
  if (decision === "non_owner") redirect("/unauthorized");
  return { client, user: user! };
}
