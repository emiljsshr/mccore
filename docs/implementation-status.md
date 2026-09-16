# Implementation status — 2026-09-16

## Verified locally

- Frontend and control-plane TypeScript checks pass.
- Full workspace production build passes with Next.js Webpack.
- 74 backend unit/integration tests pass against the isolated test database.
- Go tests and go vet pass, including preservation of a custom world name during configuration updates.
- ESLint has zero errors; five warnings remain (framework/library integration and navigation/image cleanup).
- Installer and release scripts pass Bash syntax checks.
- Browser verification: the local app redirects unauthenticated users to the real login form, including optional TOTP.

These checks do not constitute a live Minecraft lifecycle or Linux installer acceptance test.

## Completed during the handover

- Replaced frontend mock service calls with authenticated backend requests and live updates.
- Connected setup, login, password reset, profile, TOTP, session revocation, API keys, user invitations and role changes.
- Connected server lifecycle, console, files, backups, plugins, schedules and settings.
- Added server configuration commands and real provider version discovery.
- Fixed shared workspace package exports and standalone production build paths.
- Made first-administrator creation atomic, including rollback of bootstrap-token consumption.
- Added same-origin mutation checks, scoped API-key authorization and stronger WebSocket checks.
- Fixed install operation IDs, early agent acknowledgements for long-running operations and READY completion.
- Fixed agent file-list DTO conversion and sharing of console history between route scopes.
- Plugin enable/disable now renames files on a stopped server. Deletion preserves metadata when the agent rejects the command.
- Plugin update keeps the existing filename and validates project ownership. Completion is published after metadata is stored.
- Backup creation/restoration waits for operation completion before reporting success in the UI.
- Added Linux release packaging and installation, with checksum verification and archive path validation. Environment files are excluded from release output.
- Removed fake backup-policy and notification-preference save controls; the interface now states their availability.

## Remaining work before declaring the original specification complete

1. Run fresh Linux installation, bootstrap, node enrollment, Paper download/start, console, stop/restart, backup/restore and reboot recovery on a designated test host.
2. Complete and verify release update/rollback, external HTTPS provisioning and the full administrative recovery workflow.
3. Implement Fabric, Forge and NeoForge providers if all seven requested software families must ship.
4. Complete world discovery/creation/import and verify destructive world operations under concurrent lifecycle requests.
5. Finish default backup policy/retention and personal notification preferences/read state for broadcast notifications.
6. Audit all list/broadcast endpoints for per-server visibility, and test revoked access over active WebSockets.
7. Verify long-running operation reconciliation after agent/control-plane crashes, scheduler completion semantics and stale-lock recovery.
8. Verify Linux cgroup enforcement and disk quotas. Running customer Minecraft processes under the same OS user is not sufficient isolation for hostile multi-tenant hosting.
9. Add end-to-end browser coverage of authenticated workflows and independent security review.

The original README described a frontend-only mock. Older architecture/security notes contain historical claims from the previous implementation; use this status document for the current verification boundary.
