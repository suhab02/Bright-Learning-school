#!/usr/bin/env bash
# LOCAL TESTING ONLY. Builds a throwaway "bls_dev" database and runs real Supabase Auth + PostgREST.
# Needs: Postgres on $PGHOST:$PGPORT, and the auth/postgrest binaries in $BIN.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/.."
BIN=${BIN:-/opt/sbx}; export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-54329} PGUSER=postgres
export JWT_SECRET=${JWT_SECRET:-local-dev-secret-at-least-32-characters-long}
pkill -f "[a]uth serve" || true; pkill -x postgrest || true; pkill -f "[r]outer.mjs" || true; sleep 1
psql -q -d postgres -c "drop database if exists bls_dev with (force)" -c "create database bls_dev"
psql -q -d bls_dev -v ON_ERROR_STOP=1 -f "$HERE/roles.sql"
cd "$BIN"
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:localdev@localhost:$PGPORT/bls_dev?search_path=auth&sslmode=disable"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://localhost:8000/auth/v1 GOTRUE_SITE_URL=http://localhost:3000
export GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" GOTRUE_JWT_SECRET=$JWT_SECRET GOTRUE_JWT_EXP=3600
export GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_MAILER_AUTOCONFIRM=${AUTOCONFIRM:-true} GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_SMTP_ADMIN_EMAIL=admin@localhost GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
./auth migrate >/tmp/auth-migrate.log 2>&1
psql -q -d bls_dev -v ON_ERROR_STOP=1 -f "$HERE/after-auth.sql"
for f in "$ROOT"/migrations/*.sql; do psql -q -d bls_dev -v ON_ERROR_STOP=1 -f "$f"; done
psql -q -d bls_dev -v ON_ERROR_STOP=1 -f "$ROOT/seed/school.sql"
nohup ./auth serve >/tmp/auth.log 2>&1 &
PGRST_DB_URI="postgres://authenticator:localdev@localhost:$PGPORT/bls_dev" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET=$JWT_SECRET PGRST_SERVER_PORT=3001 PGRST_DB_CHANNEL_ENABLED=false nohup ./postgrest >/tmp/postgrest.log 2>&1 &
nohup node "$HERE/router.mjs" >/tmp/router.log 2>&1 &
sleep 3
node "$HERE/keys.mjs"
