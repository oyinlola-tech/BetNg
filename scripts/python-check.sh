#!/usr/bin/env bash
#
# Lints and type-checks every Python service.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failed=0

for service in simulation odds risk analytics; do
  directory="${ROOT}/services/${service}"

  if [[ ! -x "${directory}/.venv/bin/python" ]]; then
    echo "==> ${service}: no virtual environment. Run 'pnpm py:install' first."
    failed=1
    continue
  fi

  echo "==> ${service}: ruff"
  ( cd "${directory}" && ./.venv/bin/ruff check . ) || failed=1

  echo "==> ${service}: ruff format"
  ( cd "${directory}" && ./.venv/bin/ruff format --check . ) || failed=1

  echo "==> ${service}: mypy"
  ( cd "${directory}" && ./.venv/bin/mypy ) || failed=1
done

exit "${failed}"
