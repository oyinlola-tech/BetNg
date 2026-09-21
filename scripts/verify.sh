#!/usr/bin/env bash
# Frontend verification: build the shared packages, typecheck and lint every client, run the unit and component tests, build the browser apps.
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGES=(contracts client-sdk design-tokens brand ui-core mock-data)
APPS=(web tv shop admin)

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Build shared packages"
for name in "${PACKAGES[@]}"; do pnpm --filter "@betng/${name}" build; done

step "Typecheck"
pnpm --filter @betng/ui-web typecheck
for name in "${APPS[@]}" mobile; do pnpm --filter "@betng/${name}" typecheck; done

step "Lint (frontend and shared packages)"
pnpm lint:frontend

step "Unit tests (data layer, contracts, SDK, realtime, mock platform)"
pnpm exec vitest run --project unit packages

step "Component tests (jsdom)"
pnpm exec vitest run --project dom

step "Production builds"
for name in "${APPS[@]}"; do VITE_APP_ENV=production pnpm --filter "@betng/${name}" exec vite build; done

step "Production bundles contain no development stand-in"
if grep -rlE "betng-demo|betng-admin|demo@betng\.test" apps/{web,tv,shop,admin}/dist/assets >/dev/null 2>&1; then
  echo "The mock is present in a production bundle." >&2
  exit 1
fi

printf '\n\033[1;32mFrontend verified.\033[0m\n'
