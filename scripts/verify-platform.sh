#!/usr/bin/env bash
# Platform verification: typecheck, lint and test every service, then run the end-to-end scenario.
# Needs PostgreSQL and Redis (`pnpm infra:up`) and the Python environments (`pnpm py:install`).
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICES=(apps/gateway apps/services/match apps/services/betting apps/services/wallet apps/services/settlement apps/services/identity apps/services/event apps/services/email)

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Build shared packages"
for name in contracts service-kit client-sdk; do (cd "packages/${name}" && ./node_modules/.bin/tsc -p tsconfig.json); done

step "Typecheck services"
for directory in "${SERVICES[@]}"; do (cd "${directory}" && ./node_modules/.bin/tsc -p tsconfig.json --noEmit); done

step "Lint"
node tools/lint/node_modules/eslint/bin/eslint.js "${SERVICES[@]}" packages/contracts packages/client-sdk/src

step "TypeScript tests"
./node_modules/.bin/vitest run apps/gateway apps/services packages/contracts packages/client-sdk

step "Python checks and tests"
bash scripts/python-check.sh
bash scripts/python-test.sh

step "End-to-end scenario"
node scripts/e2e/scenario.mjs

printf '\n\033[1;32mPlatform verified.\033[0m\n'
