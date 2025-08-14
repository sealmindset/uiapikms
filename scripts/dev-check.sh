#!/usr/bin/env bash
# Validate that mandatory environment variables are set for local dev
# Usage: source .env && ./scripts/dev-check.sh

# auto-load repo-root .env if present
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a          # export everything we source
  source "$ENV_FILE"
  set +a
fi

set -euo pipefail

REQUIRED=(
  DATABASE_URL
  AZURE_TENANT_ID
  USER_OIDC_CLIENT_ID
  USER_OIDC_CLIENT_SECRET
  USER_OIDC_REDIRECT
  ADMIN_OIDC_CLIENT_ID
  ADMIN_OIDC_CLIENT_SECRET
  ADMIN_OIDC_REDIRECT
  SESSION_SECRET
)

missing=()
for var in "${REQUIRED[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} )); then
  echo "❌ Missing env vars: ${missing[*]}" >&2
  exit 1
fi

echo "✅ All required environment variables are set."

# Quick connectivity check for Postgres
PG_URL=${DATABASE_URL#*://}
PG_HOST_PORT=${PG_URL#*@}
PG_HOST=${PG_HOST_PORT%%:*}
PG_PORT=${PG_HOST_PORT##*:}

echo -n "⏳ Checking Postgres connectivity ... "
if pg_isready -h "$PG_HOST" -p "${PG_PORT%%/*}" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED" && exit 1
fi

# ---- Azure AD reachability ----
printf "⏳ Checking Azure AD metadata ... "
if curl -fsS "https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0/.well-known/openid-configuration" >/dev/null; then
  echo "OK"
else
  echo "FAILED" && exit 1
fi

# ---- Validate client credentials for user-ui and admin-ui ----
check_app() {
  local cid=$1
  local secret=$2
  local label=$3
  printf "⏳ Validating %s client credentials ... " "$label"
  local token
  token=$(curl -fsS -d "client_id=$cid&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&client_secret=$secret&grant_type=client_credentials" \
      "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token" | jq -r .access_token || true)
  if [[ -n "$token" && "$token" != "null" ]]; then
    echo "OK"
  else
    echo "FAILED" && exit 1
  fi
}

check_app "$USER_OIDC_CLIENT_ID" "$USER_OIDC_CLIENT_SECRET" "USER_OIDC" 
check_app "$ADMIN_OIDC_CLIENT_ID" "$ADMIN_OIDC_CLIENT_SECRET" "ADMIN_OIDC"

echo "✅ All checks passed."

exit 0
