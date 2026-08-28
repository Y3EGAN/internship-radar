import { setJobApplied } from "../jobs/actions";

export function AppliedJobButton({ jobId, title, appliedAt }: {
  readonly jobId: number;
  readonly title: string;
  readonly appliedAt: string | null;
}) {
  const applied = appliedAt !== null;
  return (
    <form action={setJobApplied} className="save-form">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="applied" value={applied ? "false" : "true"} />
      <button
        className={applied ? "applied-button is-applied" : "applied-button"}
        type="submit"
        aria-label={applied ? `Mark ${title} as not applied` : `Mark ${title} as manually applied`}
      >
        <span className="check-box" aria-hidden="true">{applied ? "✓" : ""}</span>
        {applied ? "Applied" : "Mark applied"}
      </button>
    </form>
  );
}
