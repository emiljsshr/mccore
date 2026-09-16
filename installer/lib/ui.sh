#!/usr/bin/env bash
# Shared console UI for the installer scripts: a checklist of named steps
# instead of raw subprocess output. Each step's real output (npm, apt-get,
# curl, tsc, go build, psql, systemctl, ...) goes to $log; only the step
# line itself is ever printed to the terminal, so a normal run reads like a
# clean checklist and a failure points straight at the one step that broke,
# with the relevant log tail printed inline.
#
# Callers must set `log` (a writable file path) before sourcing/using this.
#
# Usage:
#   ui_header "Building mcCore"
#   do_thing() { ...; }
#   run_step "Installing dependencies" -- do_thing
#   run_step "Downloading release" -- curl --fail -o "$dest" "$url"

if [[ -t 1 ]]; then
  ui_green=$'\033[32m'; ui_red=$'\033[31m'
  ui_dim=$'\033[2m'; ui_bold=$'\033[1m'; ui_reset=$'\033[0m'
  ui_is_tty=1
else
  ui_green=''; ui_red=''; ui_dim=''; ui_bold=''; ui_reset=''
  ui_is_tty=0
fi

ui_header() {
  printf '\n%s%s%s\n' "$ui_bold" "$1" "$ui_reset"
}

ui_note() {
  printf '  %s%s%s\n' "$ui_dim" "$1" "$ui_reset"
}

# run_step LABEL -- CMD [ARGS...]
#
# CMD runs as a backgrounded job, not as the direct operand of `||`/`if` —
# bash suspends `set -e` for a command tested that way, *including inside
# any function it calls*, so a real failure partway through a multi-command
# step function would otherwise be silently swallowed instead of stopping
# the step where it broke. Backgrounding sidesteps that: errexit stays live
# while CMD runs, and `wait` just collects its real exit status afterward.
run_step() {
  local label=$1; shift
  [[ ${1:-} == -- ]] && shift
  if [[ $ui_is_tty == 1 ]]; then
    printf '  %s %s...' '○' "$label"
  else
    printf '  %s %s...\n' '○' "$label"
  fi
  local start=$SECONDS status=0
  # shellcheck disable=SC2154  # log: set by the caller (see header above)
  "$@" >>"$log" 2>&1 &
  wait $! || status=$?
  local elapsed=$((SECONDS - start))
  if [[ $status == 0 ]]; then
    if [[ $ui_is_tty == 1 ]]; then
      printf '\r\033[K  %s%s%s %s %s(%ss)%s\n' "$ui_green" '✓' "$ui_reset" "$label" "$ui_dim" "$elapsed" "$ui_reset"
    else
      printf '  %s %s (%ss)\n' '✓' "$label" "$elapsed"
    fi
  else
    if [[ $ui_is_tty == 1 ]]; then
      printf '\r\033[K  %s%s%s %s\n' "$ui_red" '✗' "$ui_reset" "$label"
    else
      printf '  %s %s\n' '✗' "$label"
    fi
    printf '%sLast log lines (full log: %s):%s\n' "$ui_dim" "$log" "$ui_reset" >&2
    tail -n 20 "$log" >&2
    exit "$status"
  fi
}
