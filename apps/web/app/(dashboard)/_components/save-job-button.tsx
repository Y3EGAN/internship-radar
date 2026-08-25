import { setJobSaved } from "../jobs/actions";

export function SaveJobButton({ jobId, title, savedAt }: {
  readonly jobId: number;
  readonly title: string;
  readonly savedAt: string | null;
}) {
  const saved = savedAt !== null;
  return (
    <form action={setJobSaved} className="save-form">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="saved" value={saved ? "false" : "true"} />
      <button
        className={saved ? "save-button is-saved" : "save-button"}
        type="submit"
        aria-label={saved ? `Remove ${title} from saved jobs` : `Save ${title} for later`}
      >
        <span aria-hidden="true">{saved ? "★" : "☆"}</span> {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
