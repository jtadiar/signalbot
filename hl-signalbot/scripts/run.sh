#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CONFIG_PATH="${CONFIG:-$ROOT/config/config.json}"
STATE_PATH="${STATE_PATH:-$ROOT/storage/state.json}"

cd "$ROOT"

CONFIG="$CONFIG_PATH" STATE_PATH="$STATE_PATH" node index.mjs
