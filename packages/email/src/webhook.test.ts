import { describe, expect, it, vi } from "vitest";
import { handleResendWebhook } from "./webhook";

function request(): Request {
  return new Request("https://radar.example.invalid/api/webhooks/resend", {
    method: "POST", body: '{"type":"email.delivered"}',
    headers: { "svix-id": "event-1", "svix-timestamp": "1", "svix-signature": "v1,fixture" },
  });
}

describe("Resend webhook handler", () => {
  it("reads raw text, verifies headers, and records supported events", async () => {
    const verify = vi.fn().mockReturnValue({ type: "email.delivered", data: { email_id: "message-1", to: ["delivered@resend.dev"] } });
    const record = vi.fn();
    const response = await handleResendWebhook(request(), { verify }, { record }, "whsec_fixture");
    expect(response.status).toBe(200);
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ payload: '{"type":"email.delivered"}', webhookSecret: "whsec_fixture" }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-1", resendMessageId: "message-1" }));
  });

  it("makes no writes when signature verification fails", async () => {
    const record = vi.fn();
    const response = await handleResendWebhook(request(), { verify: vi.fn(() => { throw new Error("invalid"); }) }, { record }, "whsec_fixture");
    expect(response.status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
});
