#!/usr/bin/env bash
#
# Creates the `betng` database, its per-service schemas and roles. Idempotent.
# `scripts/db-bootstrap.sh betng_test` builds the integration-test database.
# Uses the local psql when there is one, otherwise the one inside the compose container.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

SQL="${ROOT}/infrastructure/postgres/bootstrap.sql"
USER_NAME="${POSTGRES_USER:-betng}"
DB_NAME="${1:-betng}"

if command -v psql >/dev/null 2>&1; then
  PGPASSWORD="${POSTGRES_PASSWORD:-betng_local_dev}" psql \
    -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-55432}" \
    -U "${USER_NAME}" -d postgres -v ON_ERROR_STOP=1 -v "dbname=${DB_NAME}" -q -f "${SQL}"
else
  docker exec -i betng-postgres psql -U "${USER_NAME}" -d postgres -v ON_ERROR_STOP=1 -v "dbname=${DB_NAME}" -q < "${SQL}"
fi

echo "Database ${DB_NAME} bootstrapped."
