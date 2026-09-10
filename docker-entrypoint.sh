#!/bin/sh
set -eu

enforcer="/app/dist/enforce-marketplace-license.cjs"
if [ ! -f "$enforcer" ]; then
  echo "DingoDocs license enforcer is missing" >&2
  exit 1
fi
node "$enforcer"
exec "$@"
