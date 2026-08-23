import { describe, expect, it, vi } from "vitest";
import { sendClaimedEmail } from "./sender";

const email = {
  outboxId: 7,
  logicalEventKey: "priority-alert/4/owner",
  recipient: "delivered@resend.dev",
  jobs: [{
    title: "Robotics Intern", company: "Example Robotics", location: "Toronto, ON", score: 88,
    url: "https://jobs.example.invalid/1", reason: "Strong verified match.",
  }],
} as const;
const options = { from: "Internship Radar <onboarding@resend.dev>", dashboardUrl: "https://radar.example.invalid/jobs" };

describe("durable email sender", () => {
  it("uses a deterministic idempotency key and records one successful send", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "resend-1" }, error: null });
    const writer = { recordSent: vi.fn(), recordFailure: vi.fn() };
    await expect(sendClaimedEmail({ emails: { send } }, writer, email, options)).resolves.toBe("sent");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["delivered@resend.dev"], html: expect.any(String), text: expect.any(String),
    }), { idempotencyKey: "priority-alert/4/owner" });
    expect(writer.recordSent).toHaveBeenCalledWith(7, "resend-1");
    expect(writer.recordFailure).not.toHaveBeenCalled();
  });

  it("renders a coalesced daily digest with a distinct subject", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "resend-digest" }, error: null });
    const writer = { recordSent: vi.fn(), recordFailure: vi.fn() };
    await sendClaimedEmail({ emails: { send } }, writer, { ...email, messageType: "daily_digest" }, options);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Daily internship digest: 1 match",
      html: expect.stringContaining("Daily fallback digest"),
    }), expect.anything());
  });

  it("retries only transient SDK errors", async () => {
    const writer = { recordSent: vi.fn(), recordFailure: vi.fn() };
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded" } });
    await expect(sendClaimedEmail({ emails: { send } }, writer, email, options)).resolves.toBe("retry_wait");
    expect(writer.recordFailure).toHaveBeenCalledWith(7, true, "rate_limit_exceeded");
  });

  it("fails terminal validation errors without retry", async () => {
    const writer = { recordSent: vi.fn(), recordFailure: vi.fn() };
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: "validation_error" } });
    await expect(sendClaimedEmail({ emails: { send } }, writer, email, options)).resolves.toBe("failed");
    expect(writer.recordFailure).toHaveBeenCalledWith(7, false, "validation_error");
  });

  it("treats thrown transport failures as retryable", async () => {
    const writer = { recordSent: vi.fn(), recordFailure: vi.fn() };
    const send = vi.fn().mockRejectedValue(new Error("fixture network detail"));
    await expect(sendClaimedEmail({ emails: { send } }, writer, email, options)).resolves.toBe("retry_wait");
    expect(writer.recordFailure).toHaveBeenCalledWith(7, true, "network_error");
  });
});
