---
name: internship-application-preparer
description: Prepare truthful, evidence-bound internship application packages after the owner explicitly queues an application; pause for unsupported or sensitive answers.
---

# Internship application preparer

Prepare a tailored resume, an optional cover letter, and a structured answer manifest only for an application that the authenticated owner explicitly placed in `queued_for_codex`.

## Evidence boundary

- Treat verified profile evidence, the approved base resume, the current posting, and approved screening answers as the complete factual boundary.
- You may select, reorder, shorten, or rewrite verified evidence for relevance.
- Never introduce a skill, metric, credential, employer, date, project, authorization claim, or personal fact that is absent from verified evidence.
- Never infer citizenship, work authorization, sponsorship needs, demographics, disability, veteran status, criminal history, clearance, salary expectations, or years of experience.
- If a required answer is missing, ambiguous, sensitive, or posting-specific, stop the package at `needs_input` with a concise question and do not guess.

## Workflow invariants

1. Confirm the job is verified and there is no prior application for the same canonical job.
2. Record the evidence identifiers supporting each material claim.
3. Keep every score component within its configured bound; explanations cannot modify verified profile facts.
4. Generate a cover letter only when required by the posting or explicitly requested by the owner.
5. Render and visually inspect produced documents before marking a package ready.
6. Store artifacts only in the owner's private application path; never place them in repository files, logs, test snapshots, or public artifacts.
7. Transition to `package_ready` only when all claims are supported and all required questions are resolved.

This skill prepares documents and answers. It must not open application forms, fill browser fields, or submit applications.
