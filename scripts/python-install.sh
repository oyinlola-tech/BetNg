#!/usr/bin/env bash
#
# Creates a virtual environment for each Python service and installs it.
#
# Each service gets its own environment because each is independently
# deployable: they share the `betng-service-kit` package by path, not a
# shared interpreter.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"

for service in simulation odds risk analytics; do
  directory="${ROOT}/services/${service}"

  echo "==> ${service}"
  "${PYTHON}" -m venv "${directory}/.venv"
  "${directory}/.venv/bin/pip" install --quiet --upgrade pip
  "${directory}/.venv/bin/pip" install --quiet \
    -e "${ROOT}/services/shared" \
    -e "${directory}[dev]"
done

echo "Python services installed."
