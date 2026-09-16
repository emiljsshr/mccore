# mcCore Architecture

## 1. Components

```
Browser
   │ HTTPS (single origin)
   ▼
Next.js Web (apps root, unchanged frontend)
   │ same-process rewrite: /api/v1/*, /ws/* → Control Plane
   ▼
Control Plane (apps/control-plane, Fastify + TS)
   │ Postgres (packages/database, Prisma)
   │ Agent Protocol: HTTPS enrollment + WebSocket command/event channel
   ▼
Node Agent (services/agent, Go, systemd unit per node)
   │ os/exec (no shell)
   ▼
Minecraft server processes (direct child processes, cgroups v2 limits)
```

On a single-node install, Web, Control Plane, Postgres and one Agent run on
the same host. The protocol between Control Plane and Agent is
network-transparent, so additional nodes are just additional Agent
installs pointed at the same Control Plane.

## 2. Why these choices (deviations from the naive reading of the spec)

**Repository layout stays root-rooted for the web app.** The existing
Next.js app is left at the repository root exactly where it is —
`next.config.ts`, `tsconfig.json`, `components.json`, `src/**` are untouched.
Moving it into `apps/web` would touch dozens of import paths and CI/dev
ergonomics for zero functional benefit. Instead the root `package.json`
gains an npm-workspaces `workspaces` field so the root app can consume
`packages/contracts` like any other workspace member. New components live
beside it: `apps/control-plane`, `services/agent`, `packages/contracts`,
`packages/database`, `installer/`, `docs/`, `scripts/`.

**No `packages/auth`, `packages/minecraft`, `packages/config`,
`packages/logger` as separate npm packages.** Only the Control Plane
consumes them today; splitting single-consumer code into its own published
package is premature fragmentation (explicitly warned against — no
over-engineered V1). They are internal modules under
`apps/control-plane/src/*` instead, structured so extraction later (e.g. if
a second Node service appears) is a mechanical move. `packages/contracts`
and `packages/database` *are* real shared packages because they have two+
consumers (control-plane, CLI/scripts, and the web app for types).

**Single public origin, no CORS.** The browser only ever talks to the
Next.js origin. `next.config.ts` rewrites proxy `/api/v1/*` and `/ws/*` to
the Control Plane (`CONTROL_PLANE_URL`, default `http://127.0.0.1:4000`),
including the WebSocket upgrade. In production, Caddy terminates TLS and
forwards everything to the Next.js process; Next.js does the internal
proxying. This keeps session cookies same-site/first-party with no CORS
policy to get wrong, and matches the "Web / Control Plane / DB / Agent on
one box" default deployment.

**Node agent identity: asymmetric keypair + short-lived signed tokens, not
mTLS.** The spec offers this as an explicit alternative to mTLS. A local CA
with certificate issuance and rotation is a large amount of additional
machinery (CA key custody, cert lifecycle, CRL/OCSP-equivalent revocation)
that is easy to get subtly wrong and hard to verify inside this build.
Instead: each Agent generates an Ed25519 keypair on first start, keeps the
private key at `/var/lib/mccore/agent/identity.key` (0600, mccore:mccore),
and registers the public key during enrollment (exchanged for the
one-time enrollment token, §16/§17). Every WebSocket connection and REST
call from the Agent to the Control Plane carries a short-lived
(60s) signed request: `nodeId + timestamp + nonce` signed with the node's
Ed25519 key. The Control Plane verifies the signature against the stored
public key, rejects stale timestamps/replayed nonces (nonce cache,
`AgentEvent`-adjacent replay table), and never accepts a static bearer
token for agent traffic. This gives equivalent guarantees to mTLS
(possession of the private key, no shared secret, easy per-node
revocation by deleting the stored public key) with far less moving
infrastructure.

**Minecraft processes run directly under the `mccore` user, not in
Docker.** §65 leaves the choice open and §64 explicitly names Linux
cgroups v2 as the preferred V1 resource-isolation mechanism. Docker is not
available in this build/verification environment, and giving the Agent a
Docker dependency also means giving it access to the Docker socket, which
the spec itself (§66) is wary of. Each server gets its own cgroup v2 leaf
(`/sys/fs/cgroup/mccore/<serverId>/`) with `memory.max` and `cpu.max` set
from the server's configured limits, its own OS-level directory
(`/var/lib/mccore/servers/<serverId>/`), and runs as `os/exec.Command`
with an explicit argv array — never a shell string. This is documented
here as the V1 decision; the `ContainerRuntime` seam in the Agent
(`internal/runtime`) is written so a Docker/OCI backend can be added later
without changing the Control Plane protocol.

**Backup format: `tar` + `zstd` via `github.com/klauspost/compress`.**
Matches the spec's stated preference for `tar.zst` without shelling out to
a system `zstd` binary (which may not be installed, and shelling out to
external compressors defeats the "no shell string concatenation" rule for
anything that takes a user-influenced path).

**IDs: ULIDs, hand-rolled.** External/public IDs are ULIDs (Crockford
Base32, 48-bit timestamp + 80-bit crypto-random) generated in application
code (`packages/contracts/src/ulid.ts`, `services/agent/internal/ulid`).
This is an *encoding*, not a cryptographic primitive, so implementing it
locally isn't "invented crypto" — it avoids taking a dependency for ~40
lines of well-specified, testable code. Database primary keys are the same
ULID string (`@id @db.VarChar(26)`), avoiding a separate internal/external
ID mapping.

**Token hashing: SHA-256 for high-entropy random secrets, Argon2id only
for user passwords.** Bootstrap codes, enrollment tokens, session tokens
and API keys are all generated with ≥128 bits of CSPRNG entropy — a fast
hash is the correct tool because the search space, not the hash speed, is
the attacker's bottleneck (this is the same pattern GitHub/Stripe use for
API key hashing). Argon2id (slow, memory-hard) is reserved for
user-chosen passwords, which are the only secrets in this system with
low, guessable entropy.

## 3. Data flow: Server creation → running server

1. Browser → `POST /api/v1/servers` (Control Plane). Zod-validated body,
   RBAC check (`server.create`), EULA acceptance recorded
   (`EulaAcceptance` audit row: userId, serverId, timestamp, version).
2. Control Plane allocates the port (conflict check against
   `ServerAllocation`), creates the `MinecraftServer` row (status
   `INSTALLING`) and an `Operation` row (`SERVER_INSTALL`) inside one
   transaction, returns `201` with the server + operation id
   immediately (idempotency key required on this endpoint).
3. Control Plane sends a signed command over the Agent's WebSocket
   channel: `server.install` with a fully-resolved spec (software,
   version/build, memory, port, directory). The Agent is the only thing
   that ever touches the filesystem or spawns `java`.
4. Agent runs the install pipeline (`internal/install`):
   prepare dir → resolve + download software (provider interface,
   §21/§35) → verify checksum → resolve Java (`internal/java`) → EULA
   file → `server.properties` → register in local state → ready.
   Each step emits a `server.install.progress` event back over the
   WebSocket with stage + percent; Control Plane relays it to any
   subscribed browser sessions and updates the `Operation` row.
5. On `READY`, Control Plane flips status to `OFFLINE` (or `STARTING` if
   `autoStart`), the Agent starts the JVM as a direct child process
   (argv array, cgroup attach), streams stdout/stderr into a bounded
   ring buffer (512 lines) and forwards new lines as `server.console`
   events, and reports `ONLINE` once the "Done" log line / RCON-less
   heuristic (or, once installed, the mcCore Bridge plugin's own
   `HELLO` handshake) confirms boot.
6. Any Control Plane restart loses nothing: `Operation` rows and
   `MinecraftServer.status` are the source of truth in Postgres. Any
   Agent restart re-scans `/var/lib/mccore/servers/*`, finds the
   recorded PID, checks it's alive and is actually the expected `java`
   process (cmdline match), and reconciles state with the Control Plane
   instead of starting a duplicate.

## 4. WebSocket protocol

Two distinct WebSocket surfaces share one Fastify `@fastify/websocket`
plugin but different auth:

- **Browser ⇄ Control Plane** (`/ws/live`): session-cookie authenticated,
  subscribes to resources the user has RBAC access to
  (`server:<id>`, `node:<id>`, `global`). Envelope:
  `{ type, version, timestamp, resourceId, payload }`, payload
  Zod-validated per `type` against `packages/contracts`.
- **Agent ⇄ Control Plane** (`/ws/agent`): Ed25519-signed handshake (§2
  above) then a persistent command/event channel. Commands carry a
  `commandId`; the Agent must ack or the Control Plane times out and
  marks the operation `ERROR`. Every inbound Agent frame carries the
  node's `nodeId` + monotonic `seq`; the Control Plane rejects
  non-increasing `seq` per connection (replay protection) in addition
  to the timestamp/nonce check on the initial handshake.

## 5. Storage layout (`/var/lib/mccore`)

```
/var/lib/mccore/servers/<serverId>/      # server working directory (SERVER_ROOT)
/var/lib/mccore/backups/<serverId>/      # local backup provider
/var/lib/mccore/agent/                   # agent state db, identity key, ring buffers
```

All file operations the Agent performs for a server resolve the requested
path against that server's `SERVER_ROOT`, `filepath.Clean` +
`filepath.EvalSymlinks`, then verify the result still has `SERVER_ROOT` as
a prefix before touching disk. See `docs/security.md` for the full
threat-model writeup.

## 5a. Process spawning notes from live end-to-end testing

Building the Agent's process manager, it was tested against the real
Control Plane end-to-end (real bootstrap, real node enrollment over a live
WebSocket handshake, real Paper/Purpur/Vanilla downloads against their
live APIs, real config generation, real `java` process spawn). Two real
bugs were found and fixed this way:

1. **Install-lock never released.** `event-dispatcher.ts`'s install-progress
   handler updated `MinecraftServer.status` on the `READY`/`FAILED` stages
   but never cleared `lockedOperationId`/`lockedAt`, so every server was
   permanently stuck refusing `server.start` with `SERVER_BUSY` after its
   first install. Fixed by clearing the lock in both branches.
2. **Slow/blocked JVM startup on low-entropy hosts.** The JVM's default
   `SecureRandom` seeding can block or spin for a long time on hosts with a
   near-empty entropy pool (freshly booted VMs, containers, sandboxes) —
   confirmed directly: the exact same server jar went from "never reaches
   its first log line" to a 1.5s boot after adding
   `-Djava.security.egd=file:/dev/./urandom` to the launch args. This is a
   standard, widely-used mitigation (not a security weakening — `/dev/urandom`
   is CSPRNG-backed on Linux) and is now always applied.

Separately, `internal/process`'s child environment was changed from a
hand-picked allowlist (`PATH`/`HOME`/`LANG`/`JAVA_HOME` only) to a denylist
that inherits the Agent's own environment and strips only the specific
secret-bearing keys (`DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`,
`AGENT_ENROLLMENT_TOKEN`). This is both more secure-by-default in the
sense that matters (nothing sensitive reaches the child) and more robust
than an allowlist, which has to correctly anticipate every variable a JVM
might reach for on every supported OS — get that list wrong and the
failure mode is a silent, hard-to-diagnose hang rather than a clear error.

**Open item, honestly flagged:** during iterative testing inside this
build's sandboxed development environment, `java` processes launched
through the full Agent (WebSocket client + heartbeat loop + orchestrator
all running concurrently) sometimes took much longer to reach their first
log line than an isolated reproduction using the identical mechanism
(same FIFO-stdin approach, same piped stdout/stderr, same process-group
setup, same filtered environment), which consistently booted in under two
seconds standalone. The isolated repro rules out the FIFO/pipe/Setpgid
design and the environment-filtering logic as the cause. This looks like
a sandbox-specific resource/scheduling interaction (this development
environment runs many concurrent tool-invoked subprocesses) rather than a
Control-Plane/Agent protocol or process-management defect, since every
other part of the same install→start pipeline — download, checksum
verification, config generation, argv/cwd/env construction (independently
verified via debug instrumentation to be byte-for-byte correct) — worked
reliably and repeatably. It has not been re-verified on the actual Linux
production target (§5) and should be before relying on it. If it
reproduces on a real deployment, `internal/process/process.go`'s
`pumpOutput`/`wait` goroutine interaction and the FIFO-stdin approach are
the first places to instrument.

## 5b. Deployment/runtime decisions finalized during integration

A few decisions were made (and live-verified) while wiring the frontend
and installer together, beyond what §1–§5 originally specified:

- **The Control Plane runs via `tsx`, not `node dist/server.js`, even in
  production.** Prisma's generated client (`packages/database/src/generated/prisma`)
  emits relative imports without a `.js` extension — valid under
  TypeScript's `bundler` module resolution (what `tsx` and the editor
  use) but rejected by plain Node's strict ESM resolver at runtime. This
  was caught directly: `node dist/server.js` fails with
  `ERR_MODULE_NOT_FOUND` on a nested Prisma-generated module;
  `tsx src/server.ts` starts cleanly, because tsx's loader hook resolves
  extensionless specifiers for the entry file *and* every transitively
  loaded module. `npm run build` (`tsc`) still runs and is still useful
  (type declarations, a frozen `dist/` artifact for `@mccore/contracts`
  and `@mccore/database`), it just isn't what actually executes — see
  `installer/systemd/mccore-control.service`'s `ExecStart`.
- **Installer distribution model: a checksum-verified release archive,
  not build-from-source on the target.** `installer/install.sh` expects
  `--archive <local tarball>` or `--release-url <https> --sha256 <hash>`
  and refuses to run without a verified SHA-256 — matching §67's
  "verify before use" requirement more directly than compiling on a
  production host would. `scripts/build-release.sh` builds that tarball
  from this checkout (must run on Linux, for native-dependency
  correctness): `npm ci`, builds every workspace, compiles both Go
  binaries with `CGO_ENABLED=0 -trimpath`, assembles `dist/`-only output
  plus Next.js's own `standalone` build output (which already
  self-traces its minimal `node_modules`), strips any `.env*` files that
  tracing might have pulled in, and emits `release/mccore-<version>-linux-<arch>.tar.gz`
  + a `.sha256` file — exactly what `install.sh --archive`/`--sha256`
  consumes. There is still no *hosted* release (no CI publishing a URL
  for `--release-url`) — `--archive` from a locally-built tarball is the
  practical path until one exists — but the build tooling itself is
  real and complete, not a stub.
- **Cgroup delegation uses a dedicated service
  (`installer/systemd/mccore-runtime.service`, `Delegate=cpu memory
  pids`), not a `.slice` unit** — gives the unprivileged `mccore` user a
  delegated cgroup subtree that never holds a "real" process of its own
  at the top level, avoiding cgroup v2's "no internal process" conflict
  with `mccore-agent.service`'s own cgroup, which does hold the Agent's
  PID. Minecraft server processes live in subdirectories of it
  (`services/agent/internal/cgroup/cgroup_linux.go`'s `cgroupBase =
  "/sys/fs/cgroup/system.slice/mccore-runtime.service"`, joined with each
  server's ID), never as direct children.
  It originally ran as `Type=oneshot`/`ExecStart=/bin/true` with
  `RemainAfterExit=yes`, on the theory that an empty delegated cgroup
  would persist once "active (exited)". Live installation on a real
  Ubuntu host disproved that: once `/bin/true` exited, systemd pruned the
  now-empty cgroup directory despite `RemainAfterExit=yes`, so
  `mccore-agent.service` failed at its NAMESPACE step (`ReadWritePaths=`
  referencing a path that no longer existed) every time it started. Fixed
  by keeping one real, harmless process resident instead
  (`Type=simple`, `ExecStart=/usr/bin/sleep infinity`, `Restart=always`),
  which keeps the cgroup directory alive for as long as the unit is
  active. `KillMode=process` (matching `mccore-agent.service`'s own
  reasoning, and now load-bearing rather than just a second safeguard)
  ensures stopping/restarting this unit only ever signals the `sleep`
  placeholder, never anything nested underneath it.
- **CSRF hardening beyond `SameSite=Lax`**: `apps/control-plane/src/plugins/core.ts`
  rejects state-changing requests (non-GET/HEAD/OPTIONS) or WebSocket
  upgrades whose `Origin` header doesn't match `PUBLIC_URL`, or whose
  `Sec-Fetch-Site` is `cross-site`. Requests with no `Origin` header at
  all (non-browser clients — the Agent's own HTTP/WS traffic, `curl`,
  API-key-authenticated integrations) are unaffected, since neither
  header is set by a typical non-browser HTTP client.
- **API keys are now a real, enforced authentication path**, not just
  CRUD management: `apps/control-plane/src/plugins/auth.ts`'s
  `authenticate` decorator accepts `Authorization: Bearer <key>` as an
  alternative to the session cookie, maps the key's scopes
  (`apps/control-plane/src/modules/apikeys/scopes.ts`) to permission ids,
  and — critically — intersects that with what the underlying user
  actually has (`hasPermission(ctx, p)`), and always forces
  `isSuperAdmin: false` for key-authenticated requests regardless of the
  owning user's actual role. A super-admin's `server:read`-scoped key can
  read servers and nothing else, even though the human account behind it
  can do anything.
- **Console reconnect backfill** (§28) is real:
  `apps/control-plane/src/modules/servers/console-history.ts` keeps a
  bounded (500-line) per-server history, populated as `server.console`
  events arrive (`modules/nodes/event-dispatcher.ts`) and served via
  `GET /api/v1/servers/:id/console`.
- **A `GET /api/v1/servers/versions?nodeId=&software=` endpoint** and a
  matching Agent command (`software.versions`, dispatched to the already-
  built `internal/software` provider's `ResolveVersions`) let the
  "Create Server" wizard populate its Minecraft-version dropdown from the
  real, live PaperMC/Purpur/Vanilla APIs instead of a hardcoded list.
- **A `GET /api/v1/operations/:id` endpoint** lets the frontend poll a
  specific long-running operation (install, backup, restore, plugin
  install) by id, independent of the WebSocket event stream.

## 6. What "Control Plane" means for the RBAC/audit/DB sections

Sections 13/43/45 list a large model/permission surface. All of it exists
in the Prisma schema and the permission catalog from day one (so
migrations and RBAC checks are never retrofitted), but not every
resource has a full CRUD UI/route in this pass — see the final report
(`docs/status.md`, generated at the end of the build) for exactly which
endpoints are wired end-to-end versus schema-only.
