import { render } from "react-email";
import { PriorityJobsEmail, type PriorityJobEmailItem } from "./priority-jobs-email";

export interface ClaimedEmail {
  readonly outboxId: number;
  readonly logicalEventKey: string;
  readonly recipient: string;
  readonly jobs: readonly PriorityJobEmailItem[];
  readonly messageType?: "priority_jobs" | "daily_digest";
}

export interface EmailStateWriter {
  recordSent(outboxId: number, resendMessageId: string): Promise<void>;
  recordFailure(outboxId: number, retryable: boolean, errorCode: string): Promise<void>;
}

export interface ResendSender {
  emails: {
    send(
      message: { from: string; to: string[]; subject: string; html: string; text: string },
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: { name: string } | null }>;
  };
}

const retryableErrorNames = new Set(["rate_limit_exceeded", "api_error", "concurrent_idempotent_requests"]);

export async function sendClaimedEmail(
  resend: ResendSender,
  writer: EmailStateWriter,
  email: ClaimedEmail,
  options: { readonly from: string; readonly dashboardUrl: string },
): Promise<"sent" | "retry_wait" | "failed"> {
  const component = <PriorityJobsEmail jobs={email.jobs} dashboardUrl={options.dashboardUrl} {...(email.messageType ? { kind: email.messageType } : {})} />;
  const [html, text] = await Promise.all([render(component), render(component, { plainText: true })]);
  try {
    const { data, error } = await resend.emails.send({
      from: options.from,
      to: [email.recipient],
      subject: email.messageType === "daily_digest"
        ? `Daily internship digest: ${email.jobs.length} ${email.jobs.length === 1 ? "match" : "matches"}`
        : `${email.jobs.length} priority internship ${email.jobs.length === 1 ? "match" : "matches"}`,
      html,
      text,
    }, { idempotencyKey: email.logicalEventKey });
    if (error !== null || data === null) {
      const code = error?.name ?? "empty_response";
      const retryable = retryableErrorNames.has(code);
      await writer.recordFailure(email.outboxId, retryable, code);
      return retryable ? "retry_wait" : "failed";
    }
    await writer.recordSent(email.outboxId, data.id);
    return "sent";
  } catch {
    await writer.recordFailure(email.outboxId, true, "network_error");
    return "retry_wait";
  }
}
