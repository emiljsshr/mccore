#!/usr/bin/env bash
set -Eeuo pipefail
# Staged files are later extracted as root on the install target and read by
# the unprivileged mccore service user; a restrictive ambient umask here
# (e.g. under `sudo` on some systems) would silently bake unreadable
# permissions into the archive. installer/install.sh also defends against
# this on the extraction side, but fixing it at the source avoids relying on
# that alone for archives built here.
umask 022
[[ $(uname -s) == Linux ]] || { echo 'Build releases on Linux so native Node dependencies match the target host.' >&2; exit 1; }
case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64) arch=arm64 ;; *) echo 'Unsupported architecture' >&2; exit 1 ;; esac
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"

if [[ -n ${BUILD_LOG:-} ]]; then
  log=$BUILD_LOG
else
  log=/tmp/mccore-build-$$.log
  : >"$log"
  # shellcheck source=installer/lib/ui.sh
  source "$root/installer/lib/ui.sh"
  ui_header "Building mcCore from source"
  ui_note "Full log: $log"
fi
# shellcheck source=installer/lib/ui.sh
[[ $(type -t run_step) == function ]] || source "$root/installer/lib/ui.sh"

run_step "Installing npm dependencies" -- npm ci

# prisma.config.ts requires DATABASE_URL to be resolvable just to load (even
# for `generate`, which only reads the schema and never opens a connection).
# A fresh checkout has no .env yet, so supply a placeholder if the build
# environment doesn't already have a real one.
generate_db_client() {
  DATABASE_URL="${DATABASE_URL:-postgresql://build:build@127.0.0.1:5432/build}" npm run generate --workspace packages/database
}
run_step "Generating database client" -- generate_db_client
run_step "Compiling shared packages" -- npm run build:shared
run_step "Compiling control plane" -- npm run build --workspace apps/control-plane
# Not `npm run build` (root package.json's "build" script): its prebuild
# hook re-runs build:shared, which the step above already did. npx resolves
# the same locally-installed next binary without that redundant hook.
run_step "Building web interface" -- npx --no-install next build --webpack

stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT

build_agent_binaries() {
  cd services/agent
  CGO_ENABLED=0 go build -trimpath -o "$stage/bin/mcagent" ./cmd/mcagent
  CGO_ENABLED=0 go build -trimpath -o "$stage/bin/mccore" ./cmd/mccore
}
mkdir -p "$stage/bin" "$stage/apps/control-plane" "$stage/packages" "$stage/web"
run_step "Building node agent binaries" -- build_agent_binaries

package_archive() {
  cp -a apps/control-plane/dist apps/control-plane/package.json apps/control-plane/tsconfig.json "$stage/apps/control-plane/"
  # mccore-control.service runs src/server.ts via tsx, not dist/server.js
  # (see the comment on that unit's ExecStart), so the source tree itself
  # has to ship too, not just its tsc-compiled dist/ output.
  cp -a apps/control-plane/src "$stage/apps/control-plane/"
  mkdir -p "$stage/packages/contracts" "$stage/packages/database/src"
  cp -a packages/contracts/dist packages/contracts/package.json "$stage/packages/contracts/"
  cp -a packages/database/dist packages/database/package.json packages/database/prisma packages/database/prisma.config.ts "$stage/packages/database/"
  # prisma/seed.ts imports the generated client from ../src/generated/prisma
  # (a source-tree path, not dist/) so it can run standalone via tsx.
  cp -a packages/database/src/generated "$stage/packages/database/src/"
  cp -a node_modules "$stage/"
  cp -a .next/standalone/. "$stage/web/"
  mkdir -p "$stage/web/.next"
  cp -a .next/static "$stage/web/.next/"
  cp -a public "$stage/web/"
  cp -a installer "$stage/"
  cp package.json package-lock.json "$stage/"
  # Next standalone output may trace dotenv files. Never ship build-host credentials.
  find "$stage" -type f \( -name '.env' -o -name '.env.*' \) -delete
  # Only the explicit application paths above are copied.
  mkdir -p release
  version=$(node -p 'require("./package.json").version')
  artifact="release/mccore-${version}-linux-${arch}.tar.gz"
  tar -C "$stage" -czf "$artifact" .
  sha256sum "$artifact" > "$artifact.sha256"
}
run_step "Packaging release archive" -- package_archive

version=$(node -p 'require("./package.json").version')
artifact="release/mccore-${version}-linux-${arch}.tar.gz"
printf 'Built %s\n' "$artifact"
