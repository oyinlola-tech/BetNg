# Development

## Prerequisites

Node 24, pnpm 11 (`packageManager` pins the version). Install once with `pnpm install --frozen-lockfile`. Port 3000 is used by another project on the reference machine; run the platform on another range (`E2E_DATABASE=betng E2E_BASE_PORT=3100 node scripts/e2e/serve.mjs`).

## Running the clients

| App | Command | Port | Notes |
| --- | --- | --- | --- |
| Web | `pnpm dev:web` | 4200 | customer web app |
| TV | `pnpm dev:tv` | 4300 | D-pad navigation, no betting |
| Shop | `pnpm dev:shop` | 4400 | cashier terminal |
| Admin | `pnpm dev:admin` | 4500 | private control plane |
| Mobile | `pnpm dev:mobile` | Expo | config in `apps/mobile/app.json` `extra` |

The shared packages build with `pnpm -r --filter './packages/*' run build` (or `pnpm verify`, which builds them first).

## Local platform

Every client talks only to the platform through the `createPlatform*` adapters in `packages/ui-core`; there is no offline stand-in. Run the platform first, then the apps:

- `pnpm dev` runs every service from source against the local Postgres and Redis (`pnpm infra:up`), with the root `.env` (`SEED_DEMO_DATA=true` seeds the accounts below on an empty database).
- `E2E_DATABASE=betng E2E_BASE_PORT=3100 node scripts/e2e/serve.mjs` runs the same services on ports 3100–3110 with a fast match clock; point the apps at it with `VITE_API_URL=http://127.0.0.1:3100` and `VITE_WS_URL=ws://127.0.0.1:3108/live`.

Routes the backend does not serve yet show "Not available yet".

### Demo accounts

Created by the identity demo seed (`apps/services/identity/src/seeds/demo.seed.ts`) in development and test only; production refuses `SEED_DEMO_DATA=true`.

| Client | Sign-in |
| --- | --- |
| Web, mobile | `demo@betng.test`, `amaka@betng.test` or `segun@betng.test` / `betng-demo` (already verified). A new registration's code is `DEV_VERIFICATION_CODE` when identity has one (the e2e stack sets `246810`), otherwise the code identity logs with `LOG_VERIFICATION_CODES=true` |
| Shop | shop `BNG-LAG-001`: `ada` (owner), `tunde` (manager), `bisi` (cashier), `kunle` (suspended), PIN `1234`; shop `BNG-ABJ-001`: `amina` (owner), PIN `4321`; password `betng-demo` |
| Admin | `ops@betng.test` (super admin) / `betng-admin` with an authenticator code. Its TOTP secret is random per database: the seed prints the enrolment URI once, and `pnpm --filter @betng/identity-service totp:dev` prints the current code. `operations@`, `risk@` and `support@betng.test` have no second factor, so the console stays locked for them |

## Environment

Only public values belong in `VITE_*` variables; see each app's `.env.example`. The important ones: `VITE_APP_ENV`, `VITE_API_URL`, `VITE_WS_URL`, `VITE_REALTIME_TRANSPORT`, `VITE_REALTIME_AUTH`, `VITE_AUTH_TRANSPORT` (`bearer` | `cookie`), `VITE_CHECKOUT_HOSTS`, `VITE_UPLOAD_HOSTS`, `VITE_FEATURE_FLAGS` and the `VITE_FEATURE_*` switches, `VITE_PRINTER` / `VITE_PRINTER_BRIDGE_URL` (shop). `readClientEnv` validates them at start-up and reports problems; `scripts/check-public-env.mjs` fails CI if a secret-looking variable or a provider secret appears in an example file, in source or in a bundle.

## Backend requirements

Served today: every route in `apps/gateway/src/routes/gateway.table.ts`. Pending (frontend built against the contract): payments, KYC, responsible gaming, account security, notification channels, cashier shifts and admin compliance, listed with methods, bodies and access rules in [`frontend-backend-contracts.md`](./frontend-backend-contracts.md#5-pending-backend-routes). Realtime: the event service's WebSocket (or SSE) endpoint with `match:{id}` channels and an account channel for signed-in users.

## Checks

`pnpm verify` (build, typecheck, lint, unit, component, production builds, no development-only data in bundles), `pnpm test:e2e`, `node scripts/check-public-env.mjs`. See [`testing.md`](./testing.md) and [`deployment.md`](./deployment.md).
