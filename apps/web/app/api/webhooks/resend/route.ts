import { handleResendWebhook } from "@internship-radar/email";
import { Resend } from "resend";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export async function POST(request: Request): Promise<Response> {
  const projectUrl = required("SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const ownerId = required("OWNER_USER_ID");
  const resend = new Resend(required("RESEND_API_KEY"));

  return handleResendWebhook(request, resend.webhooks, {
    async record(event) {
      const response = await fetch(new URL("/rest/v1/rpc/record_resend_webhook", projectUrl), {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_owner_id: ownerId,
          p_event_id: event.eventId,
          p_event_type: event.eventType,
          p_resend_message_id: event.resendMessageId,
          p_recipient: event.recipient,
          p_sanitized_metadata: {},
        }),
      });
      if (!response.ok) throw new Error("database operation failed: record_resend_webhook");
    },
  }, required("RESEND_WEBHOOK_SECRET"));
}
