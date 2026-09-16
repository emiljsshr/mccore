#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
fail() { printf 'mcCore installation failed: %s\n' "$*" >&2; exit 1; }
[[ $EUID == 0 ]] || fail 'Run this installer as root.'
source /etc/os-release
[[ ${ID:-} == ubuntu || ${ID:-} == debian ]] || fail 'Supported distributions: Ubuntu Server and Debian.'
case "$(uname -m)" in x86_64) arch=amd64; node_arch=x64 ;; aarch64) arch=arm64; node_arch=arm64 ;; *) fail 'Supported architectures: amd64 and arm64.' ;; esac
mode=standard
public_url=''
archive_url=${MCCORE_RELEASE_URL:-}
archive_sha=${MCCORE_RELEASE_SHA256:-}
local_archive=''
control_plane=''
enrollment_token=''
while (($#)); do
  case $1 in
    --mode) mode=${2:?}; shift 2 ;;
    --public-url) public_url=${2:?}; shift 2 ;;
    --release-url) archive_url=${2:?}; shift 2 ;;
    --sha256) archive_sha=${2:?}; shift 2 ;;
    --archive) local_archive=${2:?}; shift 2 ;;
    --control-plane) control_plane=${2:?}; mode=node; shift 2 ;;
    --token) enrollment_token=${2:?}; shift 2 ;;
    *) fail "Unknown option: $1" ;;
  esac
done
[[ $mode == standard || $mode == control || $mode == node ]] || fail 'Mode must be standard, control, or node.'
[[ $archive_sha =~ ^[[:xdigit:]]{64}$ ]] || fail 'Supply the trusted release SHA-256 with --sha256.'
[[ -n $local_archive || $archive_url == https://* ]] || fail 'Supply --archive or an HTTPS --release-url.'
[[ $mode != node || ( $control_plane == https://* && -n $enrollment_token ) ]] || fail 'Node mode requires an HTTPS control-plane URL and enrollment token.'
[[ $enrollment_token != *$'\n'* && $control_plane != *$'\n'* && $public_url != *$'\n'* ]] || fail 'Invalid option value.'
install -d -m 0755 /var/log/mccore /opt/mccore /etc/mccore
exec 9>/var/lock/mccore-install.lock
flock -n 9 || fail 'Another installer is running.'
log=/var/log/mccore/install.log
# Log operational output only. Bootstrap and enrollment secrets never go to this file.
trap 'printf "Installation stopped at line %s. See %s\n" "$LINENO" "$log" >&2' ERR
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/ui.sh
source "$root/lib/ui.sh"
export DEBIAN_FRONTEND=noninteractive

ui_header "mcCore installer ($mode)"
ui_note "Full log: $log"

install_prereqs() {
  apt-get update
  apt-get install -y ca-certificates curl xz-utils openssl python3 tar gzip
  if [[ $mode != node ]]; then apt-get install -y postgresql postgresql-client; fi
  if [[ $mode != control ]]; then apt-get install -y openjdk-21-jre-headless; fi
}
run_step "Installing prerequisites" -- install_prereqs

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

if [[ -n $local_archive ]]; then
  copy_release_archive() { cp -- "$local_archive" "$work/release.tar.gz"; }
  run_step "Copying release archive" -- copy_release_archive
else
  download_release_archive() { curl --proto '=https' --tlsv1.2 --fail --show-error --location --max-redirs 3 --connect-timeout 15 --max-time 1800 "$archive_url" -o "$work/release.tar.gz"; }
  run_step "Downloading release archive" -- download_release_archive
fi

verify_release_checksum() {
  printf '%s  %s\n' "$archive_sha" "$work/release.tar.gz" | sha256sum -c -
}
run_step "Verifying release checksum" -- verify_release_checksum

extract_release() {
  # Check archive paths and links before extraction as root.
  python3 - "$work/release.tar.gz" <<'PY'
import sys,tarfile,posixpath
with tarfile.open(sys.argv[1]) as archive:
 for member in archive:
  p=posixpath.normpath(member.name)
  if p.startswith('/') or p=='..' or p.startswith('../') or member.isdev() or member.isfifo(): raise SystemExit('Unsafe archive entry')
  if member.issym() or member.islnk():
   target=posixpath.normpath(posixpath.join(posixpath.dirname(p) if member.issym() else '',member.linkname))
   if target.startswith('/') or target=='..' or target.startswith('../'): raise SystemExit('Unsafe archive link')
PY
  mkdir "$work/release"
  tar --no-same-owner -xzf "$work/release.tar.gz" -C "$work/release"
  [[ -x $work/release/bin/mccore && -x $work/release/bin/mcagent ]] || { printf 'Release does not contain the %s binaries.\n' "$arch" >&2; return 1; }
}
run_step "Extracting release archive" -- extract_release

create_service_user() {
  getent passwd mccore >/dev/null || useradd --system --user-group --home /var/lib/mccore --shell /usr/sbin/nologin mccore
  install -d -o mccore -g mccore -m 0750 /var/lib/mccore /var/lib/mccore/agent /var/lib/mccore/servers /var/lib/mccore/backups
}
run_step "Creating service user and directories" -- create_service_user

if [[ $mode != node ]]; then
  install_node_runtime() {
    # Install the current Node 24 LTS patch from the official HTTPS distribution.
    curl --proto '=https' --fail --show-error --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$work/node-shasums"
    node_tar=$(awk -v a="$node_arch" '$2 ~ ("-linux-" a "\\.tar\\.xz$") {print $2}' "$work/node-shasums")
    [[ $node_tar =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { echo 'Invalid Node distribution metadata.' >&2; return 1; }
    curl --proto '=https' --fail --show-error --location "https://nodejs.org/dist/latest-v24.x/$node_tar" -o "$work/$node_tar"
    (cd "$work" && awk -v f="$node_tar" '$2==f' node-shasums | sha256sum -c -)
    install -d /opt/mccore/node
    tar --strip-components=1 -xJf "$work/$node_tar" -C /opt/mccore/node
  }
  run_step "Installing Node.js runtime" -- install_node_runtime
fi

release_dir="/opt/mccore/releases/${archive_sha,,}"
install -d /opt/mccore/releases
if [[ ! -d $release_dir ]]; then mv "$work/release" "$release_dir"; fi
if [[ -L /opt/mccore/current && $(readlink -f /opt/mccore/current) != "$release_dir" ]]; then
  fail 'A different release is already installed. Back up the database and use a reviewed migration procedure; this installer only supports fresh installation or retrying the same release.'
fi
activate_release() {
  ln -sfn "$release_dir" /opt/mccore/current
  ln -sfn /opt/mccore/current/bin /opt/mccore/bin
  ln -sfn /opt/mccore/bin/mccore /usr/local/bin/mccore
}
run_step "Activating release" -- activate_release

config=/etc/mccore/mccore.env
if [[ ! -f $config ]]; then
  write_config() {
    if [[ -z $public_url ]]; then public_url="http://$(hostname -I | awk '{print $1}'):1703"; fi
    [[ $public_url =~ ^https?://[A-Za-z0-9.:-]+$ ]] || { echo 'Public URL must be an HTTP(S) origin, without a path.' >&2; return 1; }
    db_password=$(openssl rand -hex 32)
    session_secret=$(openssl rand -hex 32)
    encryption_key=$(openssl rand -base64 32)
    {
      printf 'NODE_ENV=production\nPUBLIC_URL=%s\nCONTROL_PLANE_URL=%s\n' "$public_url" "${control_plane:-http://127.0.0.1:4000}"
      printf 'SESSION_SECRET=%s\nENCRYPTION_KEY=%s\n' "$session_secret" "$encryption_key"
      printf 'STORAGE_PATH=/var/lib/mccore/servers\nBACKUP_PATH=/var/lib/mccore/backups\nAGENT_STATE_PATH=/var/lib/mccore/agent\n'
      if [[ $mode != node ]]; then printf 'DATABASE_URL=postgresql://mccore:%s@127.0.0.1:5432/mccore\n' "$db_password"; fi
      if [[ -n $enrollment_token ]]; then printf 'AGENT_ENROLLMENT_TOKEN=%s\n' "$enrollment_token"; fi
    } >"$config"
    chmod 0600 "$config"; chown mccore:mccore "$config"
  }
  run_step "Writing configuration" -- write_config
else
  ui_note "Configuration already exists at $config, keeping it"
fi

if [[ $mode != node ]]; then
  setup_postgres() {
    systemctl enable --now postgresql
    db_password=$(sed -n 's|^DATABASE_URL=postgresql://mccore:\([^@]*\)@.*|\1|p' "$config")
    [[ $db_password =~ ^[[:xdigit:]]{64}$ ]] || { echo 'Existing DB configuration requires manual installation; refusing to change its credentials.' >&2; return 1; }
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE ROLE mccore LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='mccore')\gexec
ALTER ROLE mccore PASSWORD '$db_password';
SELECT 'CREATE DATABASE mccore OWNER mccore' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='mccore')\gexec
SQL
  }
  run_step "Setting up PostgreSQL" -- setup_postgres

  # Read env data without evaluating shell code.
  run_migrations() { /opt/mccore/node/bin/node "$release_dir/installer/provision.mjs" "$config" migrate; }
  run_step "Running database migrations" -- run_migrations
fi

install_systemd_units() {
  for unit in mccore-agent.service mccore-control.service mccore-web.service mccore-runtime.service; do
    install -m 0644 "$release_dir/installer/systemd/$unit" "/etc/systemd/system/$unit"
  done
  systemctl daemon-reload
}
run_step "Installing systemd services" -- install_systemd_units

if [[ $mode != node ]]; then
  start_control_plane() {
    systemctl enable mccore-control mccore-web
    systemctl restart mccore-control mccore-web
    for _ in {1..60}; do if curl -fsS http://127.0.0.1:4000/health/ready >/dev/null; then break; fi; sleep 2; done
    curl -fsS http://127.0.0.1:4000/health/ready >/dev/null || { echo 'Control Plane is not ready.' >&2; return 1; }
  }
  run_step "Starting control plane" -- start_control_plane
fi

if [[ $mode == standard ]]; then
  enroll_local_node() { /opt/mccore/node/bin/node "$release_dir/installer/provision.mjs" "$config" enroll; }
  run_step "Enrolling local node" -- enroll_local_node
fi

if [[ $mode != control ]]; then
  start_agent() {
    systemctl enable mccore-runtime.service mccore-agent
    systemctl restart mccore-runtime.service mccore-agent
    for _ in {1..60}; do if curl -fsS http://127.0.0.1:8085/healthz >/dev/null; then break; fi; sleep 2; done
    curl -fsS http://127.0.0.1:8085/healthz >/dev/null || { echo 'Agent is not ready.' >&2; return 1; }
  }
  run_step "Starting node agent" -- start_agent
fi

ui_header "mcCore is installed"
printf 'Configuration: %s\n' "$config"
if [[ $mode != node ]]; then
  # Not wrapped in run_step: this prints the bootstrap code itself, which
  # must stay on the terminal and never be redirected into a log file.
  /opt/mccore/node/bin/node "$release_dir/installer/provision.mjs" "$config" bootstrap
  printf 'Expose ports 80/443 through your HTTPS reverse proxy and allocate Minecraft ports as needed.\n'
  printf 'For an HTTP-only installation, restrict port 1703 to your trusted network. Production requires HTTPS.\n'
fi
