# BetNG

A virtual football platform simulation. Portfolio project — no real money, no real clubs.

## Frontend

```
pnpm install
pnpm build          # packages first (contracts → client-sdk → design-tokens → brand → ui-core → mock-data)
pnpm dev:web        # http://localhost:4200  discovery and betting
pnpm dev:tv         # http://localhost:4300  broadcast (arrow keys = remote, Enter = OK, Escape = Back)
pnpm dev:shop       # http://localhost:4400  cashier terminal
pnpm dev:admin      # http://localhost:4500  operations console
pnpm dev:mobile     # Expo
pnpm verify         # build packages, typecheck every client, unit tests, production builds
```

All clients run against an in-process virtual season by default. Point them at the platform with `VITE_DATA_SOURCE=platform` (browser apps, see `apps/*/.env.example`) or `expo.extra.dataSource` (mobile). Demo sign-ins for mock mode are listed in [`docs/frontend.md`](docs/frontend.md).

`pnpm dev` runs the platform services together (`pnpm dev:ts`, `pnpm dev:py` for one half).

- Architecture, design system and screen inventories: [`docs/frontend.md`](docs/frontend.md)
- Routes the frontend expects from the gateway, with status: [`docs/frontend-api.md`](docs/frontend-api.md)
