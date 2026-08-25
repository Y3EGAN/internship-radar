# Application package automation

The Application Package Preparer heartbeat uses `scripts/preparation-bridge.mjs` instead of a browser session. The bridge authenticates only to the fixed Internship Radar preparation endpoints and has no employer-form or submission capability.

## One-time private setup

Run the configuration command from a normal local PowerShell window:

```powershell
node scripts/preparation-bridge.mjs configure --resume "<absolute-private-resume-path>"
```

Enter the production `CODEX_PREPARATION_TOKEN` only at the hidden prompt. The bridge checks that the token is at least 32 bytes, encrypts it with current-user Windows DPAPI, and stores only ciphertext under `%LOCALAPPDATA%\InternshipRadar`. The repository, automation prompt, command line, and terminal output never receive the plaintext value.

For provider-controlled setup, `configure-env` accepts the token only from the current process environment. This is intended for a temporary Vercel environment pull that is deleted immediately after the DPAPI write; it must never be used with a token on the command line.

The safer provider rotation path is `rotate-vercel`. It requires an already-linked Vercel project directory, verifies the exact project name, generates a dedicated random token in memory, sends it to Vercel over child-process stdin, and DPAPI-protects the same value locally. The token is never placed in a command argument, file, prompt, or log. Production must be redeployed after rotation.

Use `node scripts/preparation-bridge.mjs status` to confirm configuration without exposing the credential.

## Heartbeat contract

1. `node scripts/preparation-bridge.mjs next` returns `idle`, `claimed`, or `resume` as a one-line JSON status.
2. A claim is written under the private `%LOCALAPPDATA%\InternshipRadar\preparation\<application-id>` workspace so a later heartbeat can resume without claiming another application.
3. A verified package must contain `resume.docx`, `resume.pdf`, and `package.json`. Optional cover letters require both `cover-letter.docx` and `cover-letter.pdf`.
4. `package.json` must contain `answerManifest` and a non-empty `evidenceManifest`; every material claim must list at least one evidence ID.
5. After rendering and visual verification, `node scripts/preparation-bridge.mjs complete <application-id>` uploads the package to the existing owner/application private storage path.
6. When a required answer is unsupported, ambiguous, sensitive, or posting-specific, write `questions.json` and run `node scripts/preparation-bridge.mjs needs-input <application-id>`.

The bridge never opens, fills, or submits an employer application form. Those actions remain outside the package-preparation heartbeat.
