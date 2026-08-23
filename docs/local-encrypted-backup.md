# Local encrypted database backup

Supabase Free does not provide automatic database backups. The Windows companion therefore provides an explicit local-only export:

`RADAR_DATABASE_URL=<private-libpq-url> pnpm --filter @internship-radar/local-agent radar -- backup`

The default destination is `%LOCALAPPDATA%\InternshipRadar\backups\database-<timestamp>.dump.enc`, outside the public repository. `pg_dump` must be on `PATH`.

The command streams `pg_dump --format=custom --no-owner --no-privileges` directly through AES-256-GCM. The file format is the eight-byte marker `IRDBK001`, a 12-byte IV, ciphertext, and a 16-byte authentication tag. The random 256-bit AES key is stored beside it as `<backup>.key.dpapi`, protected for the current Windows user through DPAPI. Existing destinations are never overwritten, partial failures remove both outputs, and the database URL is passed through the child environment rather than a command-line argument.

Keep the encrypted dump and DPAPI key together on a private local or removable drive. The key is intentionally bound to the Windows account that created it. Never upload either file as a public Actions artifact or add a plaintext `.dump` to the repository.

The sanitized functional test streams known fixture bytes through the same path, verifies that plaintext is absent, validates the format marker, and unwraps a 32-byte key with DPAPI. It does not connect to any database.
