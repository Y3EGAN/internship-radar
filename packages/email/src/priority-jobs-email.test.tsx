import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { PriorityJobsEmail } from "./priority-jobs-email";

const props = PriorityJobsEmail.PreviewProps;

describe("PriorityJobsEmail", () => {
  it("renders accessible, email-safe HTML below the Gmail clipping threshold", async () => {
    const html = await render(<PriorityJobsEmail {...props} />);
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(102_000);
    expect(html).toMatch(/<html[^>]*dir="ltr"[^>]*lang="en"/u);
    expect(html).toMatch(/Priority score:.*88.*100/su);
    expect(html).toContain("Open the Internship Radar dashboard");
    expect(html).not.toMatch(/display:\s*(flex|grid)/u);
    expect(html).not.toMatch(/<svg|\.webp|@media|prefers-color-scheme/iu);
  });

  it("renders a useful plain-text alternative", async () => {
    const text = await render(<PriorityJobsEmail {...props} />, { plainText: true });
    expect(text).toContain("NEW INTERNSHIPS WORTH REVIEWING");
    expect(text).toContain("Robotics Software Intern");
    expect(text).toContain("https://jobs.example.invalid/robotics-intern");
  });
});
