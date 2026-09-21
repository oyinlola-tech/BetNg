# BetNG

A virtual football platform simulation. Portfolio project — no real money, no real clubs.

## Platform

Eleven services behind one gateway, one PostgreSQL database (a schema and a login per service) and Redis for locks and caches. TypeScript services run on ZudoJS; simulation, odds, risk and analytics are Python/FastAPI.

```
cp .env.example .env
pnpm infra:up       # PostgreSQL :55432 and Redis :56379
pnpm db:bootstrap   # the betng database, schemas and logins (idempotent)
pnpm db:migrate     # Prisma migrations; the Python services migrate themselves at start-up
pnpm py:install     # one virtualenv per Python service
pnpm dev            # every service from source; gateway on :3000, live stream on ws://localhost:3008/live
pnpm e2e            # the end-to-end scenario against the real services on a throwaway database
pnpm test           # TypeScript suites        pnpm py:test   # Python suites
pnpm platform:up    # the same platform in Docker
```

`E2E_DATABASE=betng E2E_BASE_PORT=3100 node scripts/e2e/serve.mjs` runs the platform on another port range when 3000 is taken.

| Document | What it covers |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Services, database ownership, match lifecycle, RPC procedures, routes, the shared read model |
| [`docs/invariants.md`](docs/invariants.md) | The rules the platform keeps, what enforces each and the test that proves it |
| [`docs/analytics.md`](docs/analytics.md) | The definition of every reported figure |

## Frontend

```
pnpm install
pnpm build          # packages first (contracts → client-sdk → design-tokens → brand → ui-core → mock-data)
pnpm dev:web        # http://localhost:4200  customer web app, responsive to 320px
pnpm dev:tv         # http://localhost:4300  broadcast display (arrow keys = remote, Enter = OK, Escape = Back)
pnpm dev:shop       # http://localhost:4400  cashier terminal
pnpm dev:admin      # http://localhost:4500  administration control plane
pnpm dev:mobile     # Expo
pnpm verify         # build packages, typecheck and lint every client, unit + component tests, production builds
pnpm test:unit      # data layer, contracts, SDK, realtime, money, mock platform
pnpm test:dom       # component and integration tests (jsdom)
pnpm test:e2e       # Playwright: desktop, mobile and TV projects against the four apps
```

The clients talk to the platform: set `VITE_API_URL` and `VITE_WS_URL` (see `apps/*/.env.example`; defaults are the local gateway and realtime endpoint). `VITE_DATA_SOURCE=mock` opts a development or test build into an in-process stand-in (`packages/mock-data`) behind the same interfaces; the automated browser tests use it so they are deterministic. Staging and production builds ignore that setting and do not contain the stand-in.

`node scripts/smoke-platform.mjs` reads a running platform through the same adapter the clients use.

`pnpm dev` runs the platform services together (`pnpm dev:ts`, `pnpm dev:py` for one half).

| Document | What it covers |
| --- | --- |
| [`design.md`](design.md) | The visual and interaction reference every client is built from |
| [`docs/frontend-architecture.md`](docs/frontend-architecture.md) | Workspace, layers, canonical match model, state, bootstrap, authentication, errors |
| [`docs/design-system.md`](docs/design-system.md) | Tokens, components, crest system, football icons, conventions |
| [`docs/api-integration.md`](docs/api-integration.md) | Environment variables, REST client, error model, bet submission, contracts awaiting confirmation |
| [`docs/realtime.md`](docs/realtime.md) | Realtime client, event ordering, resynchronisation, connection state |
| [`docs/testing.md`](docs/testing.md) | Test layers, how to run them, what each covers |
| [`docs/frontend-api.md`](docs/frontend-api.md) | Route-by-route checklist of what the frontend calls, with status |
| [`docs/frontend.md`](docs/frontend.md) | Screen inventories per client and demo sign-ins for development |
