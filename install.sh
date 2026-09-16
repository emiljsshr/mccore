#!/usr/bin/env bash
# mcCore — one-command installer entrypoint.
#
#   git clone https://github.com/emiljsshr/mccore.git
#   cd mccore
#   sudo ./install.sh [--public-url https://panel.example.com]
#
# This builds a release archive from THIS checkout (the exact source you
# just cloned over HTTPS from GitHub) and installs it. There is no
# separate checksum to verify here on purpose: installer/install.sh's
# --archive/--sha256 pair exists for the "install a release someone else
# built" case (§67 — verify before trusting a prebuilt binary blob); this
# wrapper instead builds from source you fetched yourself over TLS and can
# read line by line, then feeds the checksum of what it just built
# straight into that same verification step, so the rest of the install
# pipeline doesn't need a second code path.
set -Eeuo pipefail

fail() { printf 'mcCore install failed: %s\n' "$*" >&2; exit 1; }

[[ $EUID == 0 ]] || fail 'Run as root: sudo ./install.sh'
[[ $(uname -s) == Linux ]] || fail 'Run this on the Linux server you want to install mcCore on (Ubuntu Server or Debian).'

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$root"
[[ -x scripts/build-release.sh && -x installer/install.sh ]] || fail 'This does not look like a full mcCore checkout (scripts/build-release.sh or installer/install.sh is missing).'

source /etc/os-release
[[ ${ID:-} == ubuntu || ${ID:-} == debian ]] || fail "Supported distributions: Ubuntu Server and Debian. Detected: ${ID:-unknown}."

export DEBIAN_FRONTEND=noninteractive
log=/tmp/mccore-bootstrap-$$.log
printf 'Installing build prerequisites (log: %s)...\n' "$log"
apt-get update >>"$log" 2>&1
apt-get install -y ca-certificates curl git build-essential >>"$log" 2>&1

# --- Architecture: Node.js and Go each use their own naming convention
# for the same two architectures (Node: x64/arm64, Go: amd64/arm64) — both
# are derived here, once, so nothing downstream has to remember to
# translate between them.
case "$(uname -m)" in
  x86_64) node_arch=x64; go_arch=amd64 ;;
  aarch64) node_arch=arm64; go_arch=arm64 ;;
  *) fail "Unsupported architecture: $(uname -m). mcCore supports amd64 and arm64." ;;
esac

# --- Node.js (build-time toolchain; separate from the runtime copy the
# installer itself places under /opt/mccore/node) -------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
  current_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [[ $current_major -ge 20 ]] && need_node=0
fi
if [[ $need_node == 1 ]]; then
  printf 'Installing Node.js (build toolchain)...\n'
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT
  curl --proto '=https' --fail --show-error --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$work/shasums"
  node_tar=$(awk -v a="$node_arch" '$2 ~ ("-linux-" a "\\.tar\\.xz$") {print $2}' "$work/shasums")
  [[ $node_tar =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || fail 'Invalid Node distribution metadata.'
  curl --proto '=https' --fail --show-error --location "https://nodejs.org/dist/latest-v24.x/$node_tar" -o "$work/$node_tar"
  (cd "$work" && awk -v f="$node_tar" '$2==f' shasums | sha256sum -c -) >>"$log"
  install -d /usr/local/lib/mccore-build-node
  tar --strip-components=1 -xJf "$work/$node_tar" -C /usr/local/lib/mccore-build-node
  ln -sf /usr/local/lib/mccore-build-node/bin/node /usr/local/bin/node
  ln -sf /usr/local/lib/mccore-build-node/bin/npm /usr/local/bin/npm
  ln -sf /usr/local/lib/mccore-build-node/bin/npx /usr/local/bin/npx
fi

# --- Go (only needed to compile the Agent/CLI binaries) -------------------
if ! command -v go >/dev/null 2>&1; then
  printf 'Installing Go (build toolchain)...\n'
  work=${work:-$(mktemp -d)}
  trap 'rm -rf -- "$work"' EXIT
  go_version=$(curl --proto '=https' --fail --show-error --location https://go.dev/VERSION?m=text | head -1)
  go_tar="${go_version}.linux-${go_arch}.tar.gz"
  curl --proto '=https' --fail --show-error --location "https://go.dev/dl/${go_tar}" -o "$work/$go_tar"
  curl --proto '=https' --fail --show-error --location "https://go.dev/dl/${go_tar}.sha256" -o "$work/$go_tar.sha256"
  printf '%s  %s\n' "$(cat "$work/$go_tar.sha256")" "$work/$go_tar" | sha256sum -c - >>"$log"
  install -d /usr/local/lib/mccore-build-go
  tar --strip-components=1 -xzf "$work/$go_tar" -C /usr/local/lib/mccore-build-go
  ln -sf /usr/local/lib/mccore-build-go/bin/go /usr/local/bin/go
fi

printf 'Building mcCore from source...\n'
bash scripts/build-release.sh

version=$(node -p 'require("./package.json").version')
archive="release/mccore-${version}-linux-${go_arch}.tar.gz"
[[ -f $archive ]] || fail "Build did not produce the expected release archive ($archive)."
sha=$(cut -d' ' -f1 "${archive}.sha256")

printf 'Installing mcCore...\n'
exec bash installer/install.sh --archive "$archive" --sha256 "$sha" "$@"
