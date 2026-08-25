import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { claimNext, completePackage, recordNeedsInput } from "./preparation-bridge.mjs";

const applicationId = "a1000000-0000-4000-8000-000000000001";
const ownerId = "b1000000-0000-4000-8000-000000000001";

function fixtureRoot() {
  return mkdtempSync(join(tmpdir(), "radar-preparation-bridge-"));
}

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("returns a one-line idle state without creating private files", async () => {
  const root = fixtureRoot();
  const result = await claimNext({
    root,
    baseUrl: "https://radar.example.invalid",
    token: "fixture-token-that-is-longer-than-thirty-two-bytes",
    baseResumePath: join(root, "base.pdf"),
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  assert.deepEqual(result, { state: "idle" });
  assert.equal(existsSync(join(root, "preparation")), false);
});

test("reports an authorization failure without echoing a response body", async () => {
  const root = fixtureRoot();
  await assert.rejects(
    claimNext({
      root,
      baseUrl: "https://radar.example.invalid",
      token: "fixture-token-that-is-longer-than-thirty-two-bytes",
      baseResumePath: join(root, "base.pdf"),
      fetchImpl: async () => jsonResponse(401, { error: "fixture-sensitive-response" }),
    }),
    (error) => error.message === "Preparation API request failed (401)" && !error.message.includes("fixture-sensitive-response"),
  );
});

test("claims once, stores private context, and resumes without another request", async () => {
  const root = fixtureRoot();
  let requests = 0;
  const options = {
    root,
    baseUrl: "https://radar.example.invalid",
    token: "fixture-token-that-is-longer-than-thirty-two-bytes",
    baseResumePath: join(root, "base.pdf"),
    fetchImpl: async (_url, init) => {
      requests += 1;
      assert.match(init.headers.authorization, /^Bearer /);
      return jsonResponse(200, {
        preparation: {
          application_id: applicationId,
          owner_id: ownerId,
          job: { canonical_url: "https://jobs.example.invalid/sample" },
          evidence: [{ id: 1, claim: "Sample claim" }],
          approved_answers: [],
          cover_letter_requested: false,
        },
      });
    },
  };
  const claimed = await claimNext(options);
  const resumed = await claimNext(options);
  assert.equal(claimed.state, "claimed");
  assert.equal(resumed.state, "resume");
  assert.equal(requests, 1);
  assert.equal(JSON.parse(readFileSync(join(claimed.workspace, "claim.json"), "utf8")).application_id, applicationId);
});

test("uploads only verified private artifacts and archives the active claim", async () => {
  const root = fixtureRoot();
  const workspace = join(root, "preparation", applicationId);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "claim.json"), JSON.stringify({ owner_id: ownerId }));
  writeFileSync(join(workspace, "resume.docx"), "fixture-docx");
  writeFileSync(join(workspace, "resume.pdf"), "fixture-pdf");
  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({ answerManifest: { answers: {} }, evidenceManifest: [{ claim: "Sample", evidenceIds: [1] }] }),
  );
  let posted;
  const result = await completePackage({
    root,
    baseUrl: "https://radar.example.invalid",
    token: "fixture-token-that-is-longer-than-thirty-two-bytes",
    applicationId,
    fetchImpl: async (_url, init) => {
      posted = JSON.parse(init.body);
      return jsonResponse(201, { packageId: "c1000000-0000-4000-8000-000000000001" });
    },
  });
  assert.equal(result.state, "package_ready");
  assert.deepEqual(posted.artifacts.map((item) => item.kind), ["resume_docx", "resume_pdf"]);
  assert.equal(existsSync(join(workspace, "claim.json")), false);
  assert.equal(existsSync(join(workspace, "package-ready-claim.json")), true);
});

test("records unresolved questions without opening or filling a form", async () => {
  const root = fixtureRoot();
  const workspace = join(root, "preparation", applicationId);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "claim.json"), JSON.stringify({ owner_id: ownerId }));
  writeFileSync(
    join(workspace, "questions.json"),
    JSON.stringify([{ fingerprint: "authorization", prompt: "Please confirm the required authorization answer." }]),
  );
  let posted;
  const result = await recordNeedsInput({
    root,
    baseUrl: "https://radar.example.invalid",
    token: "fixture-token-that-is-longer-than-thirty-two-bytes",
    applicationId,
    fetchImpl: async (_url, init) => {
      posted = JSON.parse(init.body);
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(result.state, "needs_input");
  assert.equal(posted.errorCode, "owner_input_required");
  assert.equal(posted.questions.length, 1);
});

test("rejects material claims without evidence identifiers before upload", async () => {
  const root = fixtureRoot();
  const workspace = join(root, "preparation", applicationId);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "claim.json"), JSON.stringify({ owner_id: ownerId }));
  writeFileSync(join(workspace, "resume.docx"), "fixture-docx");
  writeFileSync(join(workspace, "resume.pdf"), "fixture-pdf");
  writeFileSync(join(workspace, "package.json"), JSON.stringify({ answerManifest: {}, evidenceManifest: [{ claim: "Unsupported" }] }));
  await assert.rejects(
    completePackage({
      root,
      baseUrl: "https://radar.example.invalid",
      token: "fixture-token-that-is-longer-than-thirty-two-bytes",
      applicationId,
      fetchImpl: async () => assert.fail("upload must not run"),
    }),
    /evidence identifiers/,
  );
});
