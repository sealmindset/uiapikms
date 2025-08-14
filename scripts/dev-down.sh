#!/usr/bin/env bash
# Tear down local dev stack started by dev-up.sh
# Usage: ./scripts/dev-down.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Stop Node/Next.js dev processes (user-ui 3020, admin-ui 4000, inference 4021)
for PORT in 3020 4000 4021; do
  PID=$(lsof -t -i :$PORT) || true
  if [[ -n "$PID" ]]; then
    echo "➡️  Killing process on port $PORT (pid $PID)"
    kill "$PID" || true
  fi
done
# Also catch any lingering dev runners
pkill -f "ts-node-dev --respawn" || true
pkill -f "next dev" || true

# Stop and remove Postgres container
printf "➡️  Stopping Postgres container...\n"
docker compose stop postgres || true
printf "➡️  Removing Postgres container...\n"
docker compose rm -f postgres || true

echo "✅ Local dev stack shut down."
