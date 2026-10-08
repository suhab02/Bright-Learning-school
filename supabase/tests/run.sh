#!/usr/bin/env bash
# Rebuilds a throwaway local database and runs the SQL test suite.
# Usage: PGHOST=/tmp PGPORT=54329 supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGUSER=${PGUSER:-postgres}
DB=bls_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "• applying $f"; $P -f "$f"; done
echo "• seeding school"; $P -f seed/school.sql
for t in tests/[1-9]*.sql; do echo "• test $t"; $P -f "$t"; done
echo "ALL DATABASE TESTS PASSED"
