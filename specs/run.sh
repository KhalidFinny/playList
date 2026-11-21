#!/usr/bin/env bash
# Model-checks every spec in this directory.
#
# Each machine is checked twice: the `buggy` config is the code as it was before
# the fix and must report a violation, and the `fixed` config is the code as it is
# now and must report none. A run where the buggy model passes means the model has
# stopped describing the bug, which is as much a failure as a broken fix.
#
#   ./specs/run.sh
#
# Needs a JRE and tla2tools.jar. It is looked for at $TLA_JAR, then in
# ~/.local/share/tla, then on PATH.
set -uo pipefail

cd "$(dirname "$0")"

TLA_JAR="${TLA_JAR:-$HOME/.local/share/tla/tla2tools.jar}"
if [ ! -f "$TLA_JAR" ]; then
  echo "tla2tools.jar not found. Set TLA_JAR, or download it to $TLA_JAR:"
  echo "  curl -sSL -o \"$TLA_JAR\" https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar"
  exit 2
fi

# TLC writes state dumps and trace files next to the spec, and a violation trace
# can be hundreds of megabytes. It runs in a scratch copy instead, which is then
# deleted, so the repository never collects model-checker output.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp ./*.tla ./*.cfg "$WORK"/

status=0

check() {
  local module="$1" config="$2" expect="$3"
  local out
  out=$(cd "$WORK" && java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config "$config" -deadlock "$module.tla" 2>&1)

  local verdict="?"
  if grep -q "is violated" <<<"$out"; then verdict="violated"; fi
  if grep -q "No error has been found" <<<"$out"; then verdict="clean"; fi

  if [ "$verdict" = "$expect" ]; then
    printf '  ok    %-24s %-6s  %s\n' "$module" "$config" "$verdict"
  else
    printf '  FAIL  %-24s %-6s  expected %s, got %s\n' "$module" "$config" "$expect" "$verdict"
    status=1
  fi
}

echo "PlaybackAuthority: a listener must never move the room"
check PlaybackAuthority PlaybackAuthority-buggy.cfg violated
check PlaybackAuthority PlaybackAuthority-fixed.cfg clean

echo "AdvanceGuard: a connected client must never hold a dead request"
check AdvanceGuard AdvanceGuard-buggy.cfg violated
check AdvanceGuard AdvanceGuard-fixed.cfg clean

echo "ListenerSession: the element must never commit a stale track"
check ListenerSession ListenerSession-buggy.cfg violated
check ListenerSession ListenerSession-fixed.cfg clean

if [ "$status" -eq 0 ]; then
  echo "all models behaved as expected"
else
  echo "a model did not behave as expected"
fi
exit "$status"
