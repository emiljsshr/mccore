# mcCore Security Review

This is a development security review, not a production certification. Earlier implementation notes below include historical manual-test claims that have not all been reproduced. See [implementation status](implementation-status.md) for current verification and known gaps. A Linux installation and isolation review remain required before production use.

## Authentication

- Passwords hashed with **Argon2id** (`apps/control-plane/src/modules/auth/password.ts`),
  OWASP-baseline parameters (19 MiB memory, 2 iterations). No composition
  rules — length is what's enforced (≥12 chars), per NIST 800-63B.
- Sessions are **opaque random tokens** (32 bytes, base64url), stored
  httpOnly/SameSite=Lax/Secure when PUBLIC_URL uses HTTPS, hashed (SHA-256) at rest in
  the `Session` table — the raw token is never stored server-side and
  never appears in logs (see the logger redaction list in
  `apps/control-plane/src/logger.ts`).
- Login failures return an **identical response** whether the email
  exists or not, including matching timing (a dummy Argon2id hash is run
  for unknown emails) — verified in
  `apps/control-plane/test/integration/auth.test.ts` ("no user-existence leak").
- Logout and password-change both **invalidate sessions** server-side
  (logout: the one session; password change: every session for that
  user, forcing re-auth everywhere) — both verified by test.
- 2FA (TOTP) is fully implemented, not scaffolding: RFC 6238 codes via
  the `otpauth` library, secrets encrypted at rest (AES-256-GCM,
  `apps/control-plane/src/lib/crypto.ts`), recovery codes hashed
  (SHA-256, single-use, consumed atomically).
- Password reset tokens are real (hashed, single-use, time-limited) but
  **delivery is administrative** — no mail server is provisioned in this
  build, matching the spec's explicit allowance for this one flow. An
  operator retrieves/hands off the token out of band; it is never
  returned by the HTTP API and never logged.

## Authorization / RBAC

- Real permission-based RBAC (`packages/contracts/src/permissions.ts` is
  the single source of truth for the ~39-permission catalog; seeded into
  the `Permission`/`RolePermission` tables). Every mutating route is
  gated by `app.requirePermission("<permission.id>")`
  (`apps/control-plane/src/plugins/auth.ts`) — there is exactly **one**
  `isSuperAdmin` bypass check, in `hasPermission()`
  (`apps/control-plane/src/modules/auth/session-context.ts`), not
  scattered `role === "..."` checks through route handlers.
- Per-server scoping (§44): a non-globally-privileged user's `serverIds`
  is computed from `UserServerAccess` rows; `canAccessServer()` is called
  at every server-scoped route. Verified by test
  (`rbac.test.ts`, `auth.test.ts`'s "RBAC enforcement over HTTP" suite).
- The `owner` role (assigned only via the bootstrap flow) carries **no**
  explicit permission rows — its access is entirely the `isSuperAdmin`
  bypass, so revoking/editing role permissions can never accidentally
  lock out or over-grant the bootstrap admin's actual authority model.

## CSRF

Session cookies are `SameSite=Lax`, which blocks the classic CSRF vector
(a cross-site `<form>` POST or `fetch` cannot carry the cookie for a
state-changing cross-origin request; top-level navigations still send it,
which is what `Lax` is for and does not enable CSRF on POST/PATCH/DELETE
endpoints). Combined with the single-origin deployment model, there is no
cross-origin surface where a forged request could carry credentials that
matter.

On top of that, `apps/control-plane/src/plugins/core.ts` adds an explicit
second layer: every state-changing request (non-GET/HEAD/OPTIONS) and
every WebSocket upgrade is rejected with `403` if it carries an `Origin`
header that doesn't match `PUBLIC_URL`, or a `Sec-Fetch-Site: cross-site`
header. Requests with neither header (non-browser clients: the Agent's
own traffic, `curl`, API-key-authenticated callers) pass through
unaffected — this check only ever fires for browser-originated
cross-site requests, which is exactly the CSRF threat model. No separate
CSRF token scheme was added — `SameSite=Lax` + same-origin +
Origin/Fetch-Metadata checking is the currently-recommended layered
baseline and avoids double-submit-cookie complexity for no real gain
here.

## XSS

React's default JSX escaping is the primary defense; nothing in the
control plane returns unescaped HTML, and no route was written using
`dangerouslySetInnerHTML` or an equivalent. Console output and chat/player
messages are rendered as text content, never interpreted as markup.

## SQL Injection

All database access goes through Prisma's parameterized query builder;
the only raw SQL in the codebase is a fixed `TRUNCATE TABLE` list built
from `pg_tables` output in the **test helper** (`test/helpers/app.ts`,
never shipped/used in production code paths) and `SELECT 1` health
checks. No string-concatenated SQL exists anywhere in application code.

## Command Injection

This was a first-class design constraint, not an afterthought:

- **Minecraft process spawning** (`services/agent/internal/process/process.go`):
  every launch uses `exec.Command(javaPath, args...)` — a discrete argv
  array — never a shell string. There is no `sh -c` anywhere in the
  Agent.
- **Console commands** (kick/ban/whitelist/op/message/generic command):
  every value that becomes part of a Minecraft console command line is
  validated first. Usernames go through `MinecraftUsernameSchema`
  (`^[A-Za-z0-9_]{3,16}$`, fully anchored — rejects whitespace/newlines
  outright). Free-text fields (ban reason, chat message) are explicitly
  checked for `\r`/`\n` before being concatenated, since a newline
  reaching the child process's stdin would be interpreted as a second,
  attacker-chosen command. Verified: `contracts-validation.test.ts`'s
  username-injection cases.
- **The CLI** (`services/agent/cmd/mccore`) validates `--unit=` flags
  against a fixed map (`unitNames`) before ever building a `systemctl`/
  `journalctl` command — an arbitrary string can never reach argv.

## Path Traversal

Two independent layers, by design (defense in depth — neither trusts the
other to have already caught a bad path):

1. **Control Plane**: `RelativeServerPathSchema` (`packages/contracts`)
   rejects absolute paths, `..` segments, and null bytes before a file
   command is ever sent to an Agent.
2. **Agent** (`services/agent/internal/fsops`): `Resolve()` independently
   canonicalizes every path against the server's root — `filepath.Clean`,
   symlink resolution (`filepath.EvalSymlinks`) on both the root *and*
   the target, and a prefix check on the resolved result. This is the
   layer that actually matters for security (the Control Plane's check is
   cheap defense in depth; the Agent's is what a compromised or buggy
   Control Plane, or a malicious file already planted inside a server
   directory via a symlink, cannot bypass). Verified by
   `services/agent/internal/fsops/fsops_test.go`, including a live test
   that plants a symlink pointing outside the server root and confirms
   it's rejected (`TestResolve_RejectsSymlinkEscape`).

## SSRF

- **Server-software downloads** (`services/agent/internal/software`):
  every provider (Paper, Purpur, Vanilla) talks to exactly one hardcoded
  host; the shared downloader (`internal/netdl`) independently re-checks
  the URL's host against an allowlist and requires HTTPS before ever
  opening a connection — even if a provider had a bug, the download layer
  itself won't fetch from an unexpected host.
- **Plugin downloads**: the Control Plane resolves the concrete download
  URL itself (via the Modrinth API, from a `providerProjectId` the client
  supplied — never accepting a client-supplied URL directly), and the
  Agent's `pluginmgr` package re-validates against its own
  `cdn.modrinth.com`-only allowlist before downloading.
- **Modrinth search proxy** (`src/app/api/modrinth/search/route.ts`,
  frontend): fixed upstream host, no user-controlled URL component beyond
  query parameters forwarded into Modrinth's own query string.

## WebSocket Authentication

Two separate WebSocket surfaces, two separate trust models (see
`docs/architecture.md` §4):

- **Browser ⇄ `/ws/live`**: gated by the same session cookie as the REST
  API (`preHandler: app.authenticate` on the route), re-checked per
  subscribe request — a permission revoked mid-session stops that
  channel's events without requiring a reconnect.
- **Agent ⇄ `/ws/agent`**: no bearer token at all. Ed25519 challenge
  handshake (node signs `nodeId.timestamp.nonce` with its private key;
  Control Plane verifies against the node's stored public key), a 60-second
  timestamp window, and a nonce-reuse check (`AgentNonce` unique
  constraint) that turns a replayed handshake into a hard rejection
  rather than a race. Verified live: a real Agent enrolled and completed
  this handshake successfully against the real Control Plane multiple
  times during development, and the reconnect-after-Control-Plane-restart
  path was also observed live (exponential backoff, successful
  re-handshake).

## API Key Authentication

API keys (§46) are a real, enforced second authentication path, not just
CRUD management over a table. `apps/control-plane/src/plugins/auth.ts`'s
`authenticate` decorator accepts `Authorization: Bearer <key>` as an
alternative to the session cookie. The resulting session context is
deliberately more restricted than what a cookie session for the same user
would carry:

- `isSuperAdmin` is unconditionally forced to `false` for key-authenticated
  requests — even a super admin's API key never bypasses RBAC.
- Effective permissions are the **intersection** of the key's declared
  scopes (mapped via `modules/apikeys/scopes.ts`) and whatever the
  underlying user actually has — a key can only ever narrow access, never
  grant more than the owning account already has.
- Revocation is immediate: the key hash is looked up per request (not
  cached), so a revoked or expired key is rejected on its very next use.

Verified by test (`apps/control-plane/test/integration/completion.test.ts`,
"enforces API key scopes even when the owner is a super administrator"):
a `server:read`-scoped key can read servers but a write attempt with the
same key returns `403`, and the same key returns `401` immediately after
revocation.

## Token / Secret Leakage

- Central Pino redaction list (`logger.ts`) covers cookies, auth
  headers, and any field literally named `password`, `token`, `secret`,
  etc., as a backstop.
- Every high-entropy secret (bootstrap codes, session tokens, enrollment
  tokens, API keys, password reset tokens) is **hashed (SHA-256) at
  rest** — the plaintext exists only transiently (request body / one
  HTTP response) and is never written to the database.
- Audit log entries are populated by call sites that pass structured,
  non-secret metadata (e.g. `{ reason, expiresAt }` for a ban) — there is
  no path where a password or token value flows into `AuditLog.metadata`.

## Secret Storage

- User passwords: Argon2id (one-way).
- TOTP secrets: AES-256-GCM, key from `ENCRYPTION_KEY`
  (`/etc/mccore/mccore.env`, mode 600, generated by the installer, never
  committed).
- Bootstrap codes / session tokens / enrollment tokens / API keys:
  SHA-256 (one-way; see §"Token hashing" rationale in
  `docs/architecture.md`).
- Node identity: Ed25519 private key on disk at
  `/var/lib/mccore/agent/identity.key`, mode 0600, owned by `mccore`,
  never transmitted.
- `.env`/`mccore.env` is git-ignored (`.gitignore` explicitly excludes
  `.env*` except `.env.example`) and the Agent's child-process environment
  builder (`buildChildEnv`, `services/agent/internal/process/process.go`)
  explicitly strips `DATABASE_URL`/`SESSION_SECRET`/`ENCRYPTION_KEY`/
  `AGENT_ENROLLMENT_TOKEN` before a Minecraft server process ever
  inherits the Agent's environment.

## File Upload

Inline file writes (`file.write` command / `PUT /files/content`) are
capped (10MB, checked both at the Control Plane and inside
`internal/fsops`'s `MaxInlineFileBytes`), decoded from base64 rather than
streamed to disk unbounded, and written to a temp file + atomic rename so
a failed/partial write never corrupts the target file in place. Streaming
upload/download for larger files is a documented, explicit gap (see
"Known Limitations" in the final report) — not faked, just not built in
this pass.

## Archive Extraction (Zip Slip)

Backup restore (`services/agent/internal/backup/restore.go`) extracts
through the same `fsops.Resolve()` path-canonicalization used by the file
manager — every tar entry's name (and every symlink entry's target) is
validated against the destination root before anything is written.
Verified by a dedicated test that hand-crafts a malicious archive with a
`../../etc/evil.txt` entry and confirms extraction is refused and nothing
is written outside the restore directory
(`services/agent/internal/backup/backup_test.go`, `TestRestore_RejectsZipSlip`).
Restore is additionally atomic at the directory level: it extracts to a
staging directory first, then renames the previous server directory aside
(kept as a safety copy, not deleted) before the new one is renamed into
place — a failure mid-extraction never touches the live server directory.

## Agent Authentication (Node Identity)

See "WebSocket Authentication" above — no static/shared secret exists
anywhere in the Agent fleet. Each node's Ed25519 keypair is generated
locally on first start and never leaves that host. Revoking a
node is a matter of removing/deactivating its `NodeCredential` row
(`isActive = false`) — no key rotation ceremony needed across the fleet,
since keys aren't shared.

## Replay Attacks

- **Agent handshake**: timestamp window + nonce uniqueness constraint
  (above).
- **Agent event stream**: every in-connection event frame carries a
  monotonically increasing `seq`; the Control Plane rejects any
  non-increasing sequence number per connection
  (`apps/control-plane/src/ws/agent-hub.ts`).
- **Bootstrap code / enrollment token**: consumed inside a database
  transaction that both checks and marks-used atomically, so two
  concurrent submissions of the same valid code/token can't both
  succeed — verified for enrollment tokens by a real concurrent-request
  test (`security.test.ts`, "rejects an already-used token even if
  resubmitted concurrently").

## Privilege Escalation

- No client-controlled field ever sets `isSuperAdmin` or role
  membership on account creation (`POST /api/v1/users` explicitly
  refuses to create an `owner`-role user; only the one-time setup flow
  can create the first/only super admin, gated by the bootstrap code).
- A user can never modify their own role or status via the users API
  (self-role-change is explicitly refused — see
  `apps/control-plane/src/modules/users/routes.ts`).
- The "last owner" is protected: deleting/demoting the sole remaining
  owner-role user is refused.

## Container / Docker Permissions

**Not applicable to this build** — Minecraft server processes run
directly under the `mccore` user via `os/exec`, not in containers (see
`docs/architecture.md` for the explicit V1 decision and rationale). No
Docker socket is used or exposed anywhere in the system, which
eliminates the entire class of Docker-socket-as-root-equivalent risk the
spec's Docker-security section is concerned with. If a future version
adds a container backend, that section's requirements (no `--privileged`,
no `--network host`, no Docker socket in the Web/Control Plane process,
capabilities minimized) apply in full and should be re-reviewed then.

## Rate Limiting

`@fastify/rate-limit` applied per-route (not globally — `global: false`,
explicit opt-in per sensitive endpoint) on: login (10/min), bootstrap
verify/complete (5/min), password reset request/confirm (5–10/min), node
enrollment (10/min), enrollment token creation (20/min). Verified by test
that repeated failed logins and repeated bootstrap-code guesses both
eventually return `429` (`security.test.ts`). Rate limiting is IP-based
via Fastify's default key generator; account-based lockout (in addition
to IP) was not added in this pass — see Known Limitations.

## Known Limitations (honestly flagged, not silently skipped)

- No IP+account combined rate limiting (IP-based only today).
- File upload/download is inline-only (10MB cap), no streaming path yet
  for larger files.
- Backup restore checksum verification depends on the Control Plane
  passing `expectedSha256` (it does, via the `Backup.checksumSha256`
  column) — if a backup somehow has no recorded checksum (shouldn't
  happen via the normal create flow, but e.g. a manually-imported backup
  row could), restore proceeds without that specific check, relying on
  the extraction step's own error handling for corrupt archives.
- CSP/security headers (`Content-Security-Policy`, `X-Frame-Options`,
  etc.) were not explicitly configured on either the Next.js app or the
  Fastify responses in this pass — recommended follow-up before any
  production deployment with untrusted user-generated content rendered
  in the UI (today, the only semi-untrusted rendered content is plugin
  metadata/names from Modrinth, always rendered as React text, not HTML).
- Audit log `ipAddress` field is populated from Fastify's `request.ip`,
  which respects `trustProxy: true` (set in `app.ts`) — this is correct
  behind a properly configured reverse proxy (Caddy, per the installer)
  but would be spoofable if mcCore were ever exposed directly without a
  trusted proxy in front of it; the installer's Caddy config is the
  enforcement point for this assumption holding.
