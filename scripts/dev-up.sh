#!/usr/bin/env bash
# Spin up the full local stack (Postgres + migrations + all apps)
# Usage: ./scripts/dev-up.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

POSTGRES_URL="postgres://admin:admin@localhost:5432/apikeydb"

echo "➡️  Starting Postgres container (docker compose)"
docker compose up -d postgres

# Wait for DB ready
printf "⏳ Waiting for Postgres to accept connections"
until pg_isready -d "$POSTGRES_URL" >/dev/null 2>&1; do
  printf "."; sleep 1
done
printf " ✓\n"

export DATABASE_URL="$POSTGRES_URL"

echo "➡️  Running Prisma migrations"
pnpm exec prisma migrate deploy

echo "➡️  Launching apps (user-ui @3020, admin-ui @4000, inference-svc @4021)"
# Launch each in background with explicit envs to avoid port clashes
pnpm --filter user-ui dev &
PNPM_PID_1=$!

pnpm --filter admin-ui dev &
PNPM_PID_2=$!

PORT=4021 pnpm --filter inference-svc dev &
PNPM_PID_3=$!

wait $PNPM_PID_1 $PNPM_PID_2 $PNPM_PID_3
