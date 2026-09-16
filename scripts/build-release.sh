#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(uname -s) == Linux ]] || { echo 'Build releases on Linux so native Node dependencies match the target host.' >&2; exit 1; }
case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64) arch=arm64 ;; *) echo 'Unsupported architecture' >&2; exit 1 ;; esac
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
npm ci
# prisma.config.ts requires DATABASE_URL to be resolvable just to load (even
# for `generate`, which only reads the schema and never opens a connection).
# A fresh checkout has no .env yet, so supply a placeholder if the build
# environment doesn't already have a real one.
DATABASE_URL="${DATABASE_URL:-postgresql://build:build@127.0.0.1:5432/build}" npm run generate --workspace packages/database
npm run build:all
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/bin" "$stage/apps/control-plane" "$stage/packages" "$stage/web"
(cd services/agent && CGO_ENABLED=0 go build -trimpath -o "$stage/bin/mcagent" ./cmd/mcagent && CGO_ENABLED=0 go build -trimpath -o "$stage/bin/mccore" ./cmd/mccore)
cp -a apps/control-plane/dist apps/control-plane/package.json "$stage/apps/control-plane/"
mkdir -p "$stage/packages/contracts" "$stage/packages/database"
cp -a packages/contracts/dist packages/contracts/package.json "$stage/packages/contracts/"
cp -a packages/database/dist packages/database/package.json packages/database/prisma packages/database/prisma.config.ts "$stage/packages/database/"
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
printf 'Built %s\n' "$artifact"
