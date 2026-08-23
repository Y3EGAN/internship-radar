"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createDashboardBrowserClient } from "../../../lib/browser-client";

export function RealtimeRefresh({ ownerId }: { readonly ownerId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "degraded">("connecting");

  useEffect(() => {
    const client = createDashboardBrowserClient();
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    const refresh = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    void client.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) { if (!cancelled) setStatus("degraded"); return; }
      await client.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      const filter = `owner_id=eq.${ownerId}`;
      channel = client.channel(`owner-dashboard:${ownerId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "source_runs", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "source_endpoints", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "email_outbox", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "device_tokens", filter }, refresh)
        .subscribe((nextStatus) => {
          if (nextStatus === "SUBSCRIBED") setStatus("connected");
          if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") setStatus("degraded");
        });
    });
    return () => {
      cancelled = true;
      if (timer.current !== null) clearTimeout(timer.current);
      if (channel) void client.removeChannel(channel);
    };
  }, [ownerId, router]);

  return <span className="sr-only" role="status" aria-live="polite">Dashboard live updates: {status}</span>;
}
