#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Starting all backend services..."
pnpm dev &
BACKEND_PID=$!

echo "Starting frontend apps..."
pnpm --filter @betng/web dev &
pnpm --filter @betng/tv dev &
pnpm --filter @betng/shop dev &
pnpm --filter @betng/admin dev &

cleanup() {
  echo "Stopping all services..."
  kill -- -$$ 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "All services started. Ctrl+C to stop everything."
wait
