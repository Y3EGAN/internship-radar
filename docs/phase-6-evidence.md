# Phase 6 gate evidence

Verified locally on 2026-08-22 with the project application-preparer skill, the bundled document toolchain, Microsoft Word export, Poppler rasterization, and sanitized fixture data.

## Truth-preserving preparation

- Preparation can begin only through the owner-triggered `queue_application_preparation` RPC for a verified job with a verified source and no prior application.
- A skip-locked worker claim atomically transitions one queued application to `preparing` and returns its job, unexpired evidence bank, approved answers, and cover-letter selection.
- The preparation evaluator rejects unqueued work, unverified jobs, duplicate applications, unknown/expired evidence, unsupported material terms, and unsupported metrics.
- Required contextual and never-infer questions stop at `needs_input` unless explicitly confirmed for the specific application. Cover letters are produced only when required or selected.
- Completion revalidates every evidence ID, requires owner/application-scoped document paths, supersedes prior packages, and transitions to `package_ready`. Failure records only sanitized error codes and unresolved questions.

## Private APIs and artifacts

- Server-only bearer-authenticated routes implement claim, package completion, and safe failure recording. Bearer comparison uses fixed-length SHA-256 digests and constant-time comparison.
- The package route requires both resume DOCX and PDF, limits each artifact to 5 MB, uploads only to the private `application-documents` bucket under `owner/application`, and removes partial uploads if the database transition fails.
- Service-role and Codex preparation tokens appear only in server modules and sanitized environment examples. The browser artifact scan found none of their token names in 48 static files.
- The public repository contains only the builder, evaluator, and anonymous fixture. Generated DOCX/PDF/PNG artifacts remain under ignored `outputs/` paths.

## Document and eval gate

- The builder uses a fully resolved `standard_business_brief` token set: US Letter, one-inch margins, explicit Calibri type/spacing, real Heading 1 styles, real OOXML bullet numbering, and a restrained resume-header override.
- It rejects unknown evidence references and unsupported metrics before authoring. Three Python tests verify document geometry/style/content and both rejection paths.
- The anonymous fixture was metadata-scrubbed. LibreOffice was unavailable, so the allowed fallback used installed Microsoft Word to export PDF and bundled Poppler to rasterize the single page.
- The PNG was inspected at full resolution: no clipping, overlap, broken bullets, missing glyphs, or footer/page issues were present. The sparse layout correctly reflects the intentionally small fixture evidence bank.
- The bundled DOCX accessibility audit reported zero high, medium, or low findings.

## Gate results

- Eight preparation evals, five web tests, three document-builder tests, and all 103 pgTAP assertions pass.
- Web/preparation/core lint and TypeScript checks pass; generated database types match.
- Supabase security advisors report no issues. Performance advisors report only expected unused-index information on the freshly reset fixture database.
- The production build emits all three Codex preparation routes plus the owner-triggered job action, and the privacy scan passes across 175 public candidate files.

No real resume, evidence, screening answer, or application artifact was read or written during this gate.
