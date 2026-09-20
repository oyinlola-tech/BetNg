# BetNG

A virtual football platform simulation. Portfolio project — no real money, no real clubs.

## Frontend

```
pnpm install
pnpm build          # packages first (contracts → client-sdk → design-tokens → ui-core → mock-data)
pnpm dev:web        # http://localhost:4200
pnpm dev:tv         # http://localhost:4300  (arrow keys = remote, Enter = OK, Escape = Back)
pnpm dev:mobile     # Expo
```

All clients run against an in-process virtual season by default. Point them at the platform with `VITE_DATA_SOURCE=platform` (web/TV, see `apps/*/.env.example`) or `expo.extra.dataSource` (mobile).

- Architecture and screen inventories: [`docs/frontend.md`](docs/frontend.md)
- Routes the frontend expects from the gateway, with status: [`docs/frontend-api.md`](docs/frontend-api.md)
