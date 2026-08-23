import "client-only";
import { createBrowserClient } from "@supabase/ssr";

export function createDashboardBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.invalid",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "fixture-publishable-key",
  );
}
