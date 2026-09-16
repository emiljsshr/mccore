# Cometa mcCore

Minecraft server management with a Next.js frontend, a Fastify control plane, PostgreSQL/Prisma, and a Go node agent. The frontend uses authenticated HTTP and WebSocket connections; application lists no longer start with demo data.

This is a development build. See [implementation status](docs/implementation-status.md) for verified behavior and remaining work before production deployment.

## Quick install (Ubuntu Server / Debian)

On a fresh Ubuntu Server or Debian host (amd64 or arm64):

~~~bash
git clone https://github.com/emiljsshr/mccore.git
cd mccore
sudo ./install.sh
~~~

This installs the build toolchain it needs (Node.js, Go), builds a release
from the checkout you just cloned, and installs mcCore — PostgreSQL,
systemd services, the local node, and a one-time setup code printed at the
end. Pass `--public-url https://your-domain` if you have a domain pointed
at the server; without one it prints `http://SERVER-IP:1703` and a clear
warning that production needs HTTPS in front of it (§53 — see
`docs/architecture.md`).

For a prebuilt, checksum-verified release archive instead of building on
the target (e.g. installing on many nodes from one build), see
`scripts/build-release.sh` and `installer/install.sh --archive`/`--release-url` below.

## Local development

Requirements: Node.js 24 or newer, PostgreSQL, Go matching services/agent/go.mod, and an appropriate Java runtime on each Minecraft node.

1. Copy .env.example to .env and configure DATABASE_URL, SESSION_SECRET and ENCRYPTION_KEY. Generate the secrets with openssl rand -hex 32 and openssl rand -base64 32 respectively.
2. Create the PostgreSQL database with the configured owner.
3. Install and build the workspace:

~~~bash
npm ci
npm run generate --workspace packages/database
npm run build:shared
npm run db:migrate
npm run db:seed
npm run dev:all
~~~

Open http://localhost:3000. An unconfigured instance requires a one-time bootstrap code before its first administrator can be created. There is no default administrator password. The Linux installer prints the code; on an installed host it can be rotated using sudo mccore admin bootstrap-code rotate.

The UI proxies /api/v1 and /ws to CONTROL_PLANE_URL, which defaults to http://127.0.0.1:4000. Set PUBLIC_URL to the browser-facing origin. Cookies are Secure for HTTPS origins. Use HTTPS for any externally accessible deployment.

## Verification

~~~bash
npm run typecheck
npm run lint
npm test
npm run build:all
(cd services/agent && go test ./... && go vet ./...)
bash -n installer/install.sh scripts/build-release.sh
~~~

Backend integration tests require a separate PostgreSQL database. Set TEST_DATABASE_URL to a database whose name ends in _test; tests truncate its application tables. Never point it at application data.

Production builds use Webpack explicitly. This also avoids the local Turbopack build worker's port-binding failure observed on macOS.

## Linux release and installation

The installer targets Ubuntu/Debian with systemd, on amd64 or arm64. Windows and macOS are development environments, not installer targets. A Windows machine can host a Linux VM for testing.

Build on Linux with the same architecture as the target:

~~~bash
bash scripts/build-release.sh
~~~

The script produces release/mccore-0.1.0-linux-ARCH.tar.gz and its SHA-256 file. Copy the archive and installer to the designated test host. Supply the verified hash explicitly:

~~~bash
sudo bash installer/install.sh --archive /path/to/release.tar.gz --sha256 TRUSTED_SHA256 --public-url https://panel.example.com
~~~

The installer creates the service user, PostgreSQL database, application directories and systemd services, applies migrations, enrolls the local node and prints the bootstrap code. It supports standard, control-only and node-only modes. Review installer/install.sh for their arguments.

HTTPS termination must be configured separately. Route /api/v1/* and /ws/* to the control plane on loopback port 4000, and other requests to the web service on port 1703. Keep database and agent health ports private.

The installer supports a fresh installation or retrying the same release. It deliberately rejects replacing an existing installation with a different release until the migration/rollback workflow has been completed and tested.

## Layout

- src: Next.js interface, API services and client caches.
- apps/control-plane: authentication, RBAC, HTTP/WebSocket API, operations and scheduling.
- packages/contracts: validated shared DTOs and agent protocol.
- packages/database: Prisma schema, migrations and database client.
- services/agent: node daemon, Minecraft processes, downloads, files, backups and administrative CLI.
- installer: Linux provisioning and systemd units.
- scripts/build-release.sh: Linux release packaging.
- docs: architecture, security and current implementation status.

Implemented download providers are Paper, Purpur, Vanilla and Velocity. Their version lists are requested from the connected node; Fabric, Forge and NeoForge are not yet available.
