import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { emailTailwindConfig } from "./tailwind.config";

export interface PriorityJobEmailItem {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly score: number;
  readonly url: string;
  readonly reason: string;
}

export interface PriorityJobsEmailProps {
  readonly jobs: readonly PriorityJobEmailItem[];
  readonly dashboardUrl: string;
  readonly kind?: "priority_jobs" | "daily_digest";
}

export function PriorityJobsEmail({ jobs, dashboardUrl, kind = "priority_jobs" }: PriorityJobsEmailProps) {
  const digest = kind === "daily_digest";
  const preview = `${jobs.length} internship ${jobs.length === 1 ? "match" : "matches"} ${digest ? "in your daily digest" : "ready to review"}`;
  return (
    <Html lang="en" dir="ltr">
      <Tailwind config={emailTailwindConfig}>
        <Head />
        <Body className="m-0 bg-canvas px-3 py-6 font-sans">
          <Preview>{preview}</Preview>
          <Container lang="en" dir="ltr" className="mx-auto max-w-[600px] bg-surface p-6 text-ink">
            <Text className="m-0 text-[12px] font-bold uppercase tracking-[1px] text-priority">
              {digest ? "Daily fallback digest" : "Priority matches"}
            </Text>
            <Heading as="h1" className="mb-2 mt-2 text-[26px] font-bold leading-[32px] text-ink">
              {digest ? "Your saved internship matches" : "New internships worth reviewing"}
            </Heading>
            <Text className="mb-6 mt-0 text-[16px] leading-[24px] text-muted">
              {digest
                ? "These verified roles were coalesced after the daily email safety cap was reached. Scores are preliminary and based only on your saved criteria."
                : "These verified roles crossed your alert threshold. Scores are preliminary and based only on your saved criteria."}
            </Text>

            {jobs.map((job) => (
              <Section key={`${job.company}:${job.url}`} className="mb-4 border border-solid border-line p-4">
                <Text className="m-0 text-[13px] font-bold text-priority">Priority score: {job.score}/100</Text>
                <Heading as="h2" className="mb-1 mt-2 text-[19px] font-bold leading-[25px] text-ink">
                  {job.title}
                </Heading>
                <Text className="m-0 text-[15px] leading-[22px] text-muted">
                  {job.company} · {job.location || "Location not listed"}
                </Text>
                <Text className="mb-3 mt-3 text-[15px] leading-[22px] text-ink">{job.reason}</Text>
                <Link href={job.url} className="text-[15px] font-bold text-brand underline">
                  Review {job.title} at {job.company}
                </Link>
              </Section>
            ))}

            <Button
              href={dashboardUrl}
              className="box-border block bg-brand px-5 py-3 text-center text-[16px] font-bold text-white no-underline"
            >
              Open the Internship Radar dashboard
            </Button>
            <Hr className="my-6 border-solid border-line" />
            <Text className="m-0 text-[12px] leading-[18px] text-muted">
              This transactional alert was requested in your Internship Radar settings. Source schedules are best-effort and may be delayed.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

PriorityJobsEmail.PreviewProps = {
  jobs: [{
    title: "Robotics Software Intern",
    company: "Example Robotics",
    location: "Toronto, ON",
    score: 88,
    url: "https://jobs.example.invalid/robotics-intern",
    reason: "Strong robotics and controls alignment with a preferred location.",
  }],
  dashboardUrl: "https://radar.example.invalid/jobs",
} satisfies PriorityJobsEmailProps;

export default PriorityJobsEmail;
