export interface VerifiedResendEvent {
  readonly type: string;
  readonly data: { readonly email_id?: string; readonly to?: readonly string[] };
}

export interface WebhookVerifier {
  verify(input: {
    readonly payload: string;
    readonly headers: { readonly id: string; readonly timestamp: string; readonly signature: string };
    readonly webhookSecret: string;
  }): unknown;
}

export interface WebhookRecorder {
  record(input: {
    readonly eventId: string;
    readonly eventType: string;
    readonly resendMessageId: string;
    readonly recipient: string;
  }): Promise<void>;
}

const handledEvents = new Set([
  "email.delivered", "email.bounced", "email.complained", "email.delivery_delayed", "email.suppressed",
]);

function asVerifiedEvent(value: unknown): VerifiedResendEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { readonly type?: unknown; readonly data?: unknown };
  if (typeof candidate.type !== "string" || typeof candidate.data !== "object" || candidate.data === null) return null;
  const data = candidate.data as { readonly email_id?: unknown; readonly to?: unknown };
  return {
    type: candidate.type,
    data: {
      ...(typeof data.email_id === "string" ? { email_id: data.email_id } : {}),
      ...(Array.isArray(data.to) && data.to.every((item) => typeof item === "string") ? { to: data.to as string[] } : {}),
    },
  };
}

export async function handleResendWebhook(
  request: Request,
  verifier: WebhookVerifier,
  recorder: WebhookRecorder,
  secret: string,
): Promise<Response> {
  const payload = await request.text();
  const eventId = request.headers.get("svix-id");
  try {
    const event = asVerifiedEvent(verifier.verify({
      payload,
      headers: {
        id: eventId ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    }));
    if (event !== null && eventId !== null && handledEvents.has(event.type) && event.data.email_id !== undefined) {
      await recorder.record({
        eventId,
        eventType: event.type,
        resendMessageId: event.data.email_id,
        recipient: event.data.to?.[0] ?? "unknown@example.invalid",
      });
    }
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
}
