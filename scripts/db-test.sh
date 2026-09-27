#!/usr/bin/env bash
#
# The per-service integration-test databases, betng_test_<service>.
#   scripts/db-test.sh          creates each one and applies its migrations. Idempotent; removes nothing.
#   scripts/db-test.sh reset    empties the ones that exist.
# Uses the local psql when there is one, otherwise the one inside the compose container.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

SERVICES=(betting email identity match settlement wallet)
SQL="${ROOT}/infrastructure/postgres/reset-test.sql"
USER_NAME="${POSTGRES_USER:-betng}"
MODE="${1:-prepare}"

if [[ "${MODE}" != "prepare" && "${MODE}" != "reset" ]]; then
  echo "Usage: scripts/db-test.sh [prepare|reset]" >&2
  exit 64
fi

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Test databases are not managed with NODE_ENV=production." >&2
  exit 1
fi

run_psql() {
  local database="$1"
  shift

  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${POSTGRES_PASSWORD:-betng_local_dev}" PGCONNECT_TIMEOUT=5 psql -X \
      -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-55432}" \
      -U "${USER_NAME}" -d "${database}" -v ON_ERROR_STOP=1 -q "$@"
  else
    docker exec -i betng-postgres psql -X -U "${USER_NAME}" -d "${database}" -v ON_ERROR_STOP=1 -q "$@"
  fi
}

existing_databases() {
  run_psql postgres -At -c "SELECT datname FROM pg_database WHERE datname LIKE 'betng\_test\_%'"
}

reset() {
  run_psql "$1" -f - < "${SQL}"
}

if [[ "${MODE}" == "reset" ]]; then
  if ! existing="$(existing_databases 2>/dev/null)"; then
    echo "Postgres is not reachable; no test database was reset."
    exit 0
  fi

  for service in "${SERVICES[@]}"; do
    database="betng_test_${service}"

    if grep -qx "${database}" <<< "${existing}"; then
      reset "${database}"
    fi
  done

  exit 0
fi

for service in "${SERVICES[@]}"; do
  database="betng_test_${service}"
  variable="${service^^}_DATABASE_URL"
  url="${!variable:-}"

  if [[ -z "${url}" ]]; then
    echo "${variable} is not set; copy .env.example to .env." >&2
    exit 1
  fi

  bash "${ROOT}/scripts/db-bootstrap.sh" "${database}"

  env "${variable}=$(sed -E "s#(://[^/]+/)[^?]+#\1${database}#" <<< "${url}")" \
    pnpm --dir "${ROOT}/apps/services/${service}" exec prisma migrate deploy
done

echo "Test databases ready: ${SERVICES[*]/#/betng_test_}."
