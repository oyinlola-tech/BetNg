#!/usr/bin/env bash
#
# Runs every Python service's test suite.
#
# Exits non-zero if any service fails, so CI and `pnpm verify` see one
# result rather than the last service's.

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

  echo "==> ${service}"
  ( cd "${directory}" && ./.venv/bin/python -m pytest -q ) || failed=1
done

exit "${failed}"
