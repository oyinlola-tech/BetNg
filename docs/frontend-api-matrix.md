# Frontend ↔ API Wiring Matrix

One row per feature: the screen, the route it calls, who may call it, the realtime signal that refreshes it, the TanStack Query key it caches under, what a mutation invalidates, the errors the screen handles, and whether the backend serves the route today. Paths are under `/api/v1`. Contracts and error semantics: [`frontend-backend-contracts.md`](./frontend-backend-contracts.md). Served paths are authoritative in `apps/gateway/src/routes/gateway.table.ts`.

Status: **served** — the gateway routes it today · **pending** — contract defined, adapter built, backend not deployed (the adapter answers `NOT_IMPLEMENTED`; the feature flag is off by default).

Common error states on every row: `NETWORK`/`OFFLINE`/`TIMEOUT` (retry), `UNAVAILABLE` (retry), `SESSION_EXPIRED` (sign-in dialog, place kept), `FORBIDDEN`, `RATE_LIMITED` (seconds from `Retry-After`). Only row-specific errors are listed.

## Customer — web and mobile

| Feature | Screen | Method · Path | Auth | Realtime | Cache key | Invalidates | Specific errors | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Config and flags | app bootstrap | GET `/config` | public | — | runtime (once) | — | falls back to defaults | served |
| Leagues | header league bar, Leagues | GET `/leagues` | public | — | `leagues` | — | — | served |
| Teams | Team, search | GET `/teams` | public | — | `teams` | — | NOT_FOUND | served |
| Match list | Home, Live, Virtuals | GET `/matches`, GET `/odds?matchIds=` | public | `matches` channel signals | `matches`, `odds` | — | empty state | served |
| Match centre | Match | GET `/matches/:id`, `/events`, `/stats`, `/lineups`, `/head-to-head`, `/matches/:id/odds` | public | `match:{matchId}` events and lifecycle signals | `match`, `markets` | re-read on `BETTING_*`, `ODDS_UPDATED`, `MARKET_UPDATED`, `SETTLEMENT_*` | NOT_FOUND | served |
| Results | Results | GET `/results` (+ `/matches?status=COMPLETED`) | public | — | `results` | — | empty state | served |
| Standings | Standings, League | GET `/leagues/:id/standings`, `/leagues/:id/scorers` | public | — | `standings`, `scorers` | — | NOT_IMPLEMENTED if unserved (never computed in the browser) | served |
| Search | Search dialog (`/` shortcut) | GET `/search?q&kinds&limit` | public | — | `search` (debounced) | — | empty state | served |
| Register / verify | Register | POST `/auth/register`, `/auth/verify`, `/auth/verify/resend` | public, rate limited | — | — | session | CONFLICT (exists), VALIDATION | served |
| Sign in | Login dialog/page | POST `/auth/login` | public, rate limited | — | — | all private keys on success | INVALID_CREDENTIALS, TWO_FACTOR_REQUIRED | served; 2FA answer pending |
| 2FA challenge | Login code step | POST `/auth/login/2fa` | challenge | — | — | session | VALIDATION, SESSION_EXPIRED (challenge expired) | pending |
| Password reset | Forgot / Reset password | POST `/auth/password/forgot`, POST `/auth/password/reset` | public | — | — | — | VALIDATION (code, breach) | forgot served; reset pending |
| Sign out | shell | POST `/auth/logout` | token | private channels closed | — | removes every private query | ignored (token dropped either way) | served |
| Session refresh | session timeout warning | POST `/auth/session/refresh` | customer | — | — | session expiry | NOT_IMPLEMENTED → "sign in again" | pending |
| Place bet | Bet slip | POST `/bets` + `idempotency-key` | customer | `bets:{userId}` / account signal | — | `wallet`, `bets`, `transactions` | ODDS_CHANGED, MARKET_SUSPENDED, BETTING_CLOSED, STAKE_LIMITED, BET_REJECTED, INSUFFICIENT_FUNDS, SELF_EXCLUDED, LIMIT_EXCEEDED | served |
| My bets | Tickets, Ticket | GET `/bets`, GET `/bets/:id`, GET `/settlements/:betId` | customer | account signal | `bets`, `bet` | — | NOT_FOUND | served |
| Wallet | Wallet | GET `/wallets/:userId` | customer (own id only) | account signal (`wallet.updated`) | `wallet` | — | — | served |
| Transactions | Transactions (URL filters) | GET `/wallets/:userId/transactions?page&pageSize&types&statuses&from&to&search&sort&direction` | customer | account signal | `transactions` | — | — | served |
| Platform wallet top-up (flag off) | Wallet dialog | POST `/wallets/deposit`, `/wallets/withdraw` | customer | — | — | `wallet`, `transactions` | INSUFFICIENT_FUNDS | served |
| Deposit | Deposit, Payment status | POST `/payments/deposit/initiate` + key; POST `/payments/deposit/verify` (polled with backoff) | customer | account signal | `payments` | `wallet`, `transactions`, `payments` on every status change | LIMIT_EXCEEDED, SELF_EXCLUDED, KYC_REQUIRED, PAYMENT_FAILED; blocked non-allowlisted checkout | pending |
| Withdrawal | Withdraw | POST `/payments/withdraw/quote`; POST `/payments/withdraw/request` + key; GET `/payments/withdraw/status/:reference` | customer | account signal | `payments` | `wallet`, `transactions`, `payments` | INSUFFICIENT_FUNDS, KYC_REQUIRED, LIMIT_EXCEEDED | pending |
| Payment history | Payments (URL filters) | GET `/payments/history?page&pageSize&direction&status` | customer | account signal | `payments` | — | — | pending |
| Bank accounts | Bank accounts | GET `/payments/banks`; POST `/payments/bank-accounts/verify`; POST/GET `/payments/bank-accounts`; POST `/payments/bank-accounts/:id/default`; DELETE `/payments/bank-accounts/:id` | customer | — | `banks`, `bankAccounts` | `bankAccounts` | NOT_FOUND (name enquiry), CONFLICT (verification expired / withdrawal in flight) | pending |
| Statements | Statements | POST `/account/statements`; GET `/account/statements/:id` (polled) | customer | — | `statements` | — | download only from allowlisted https / API origin | pending |
| KYC | KYC | GET `/kyc/status`, `/kyc/documents`; POST `/kyc/documents/uploads` → PUT upload target → POST `/kyc/documents`; POST `/kyc/verify/bvn`, `/kyc/verify/nin` | customer | account signal (KYC update notification) | `kyc` | `kyc` | VALIDATION (type/size/number), upload host not allowlisted, upload cancelled | pending |
| Responsible gaming | Responsible gaming, restricted banner | GET `/limits/summary`, `/limits/history`; PUT `/limits`; DELETE `/limits/:kind`; POST/DELETE `/limits/self-exclude` | customer | account signal | `limits` | `limits` (+ `wallet` gating) | VALIDATION (password), CONFLICT (cannot cancel yet) | pending |
| Password change | Account › Security | PUT `/account/password` | customer | — | — | — | VALIDATION (current wrong, breached) | pending |
| Two-step verification | Account › Security | GET `/account/2fa`; POST `/account/2fa/enroll`, `/confirm`, `/disable`, `/backup-codes` | customer | — | `twoFactor` | `twoFactor` | VALIDATION (code), CONFLICT | pending |
| Sessions | Account › Sessions | GET `/account/sessions`; DELETE `/account/sessions/:id`; DELETE `/account/sessions` | customer | — | `sessions` | `sessions` | CONFLICT (current session) | pending |
| Notification channels | Account › Notifications | GET/PUT `/notifications/preferences` | customer | — | `channelPreferences` | `channelPreferences` | VALIDATION (locked channel) | pending |
| Push devices | Account › Notifications (mobile registers) | GET `/notifications/push/devices`; POST `/notifications/push/register`; DELETE `/notifications/push/devices/:id` | customer | — | `pushDevices` | `pushDevices` | permission denied on device | pending |
| In-app notifications | Notifications | GET `/users/:id/notifications`; POST `/users/:id/notifications/read` | customer | `notifications:{userId}` | `notifications` | `notifications` | — | served |
| Account deletion | Account › Delete account | GET/POST(+ key)/DELETE `/account/deletion` | customer | — | `deletion` | `deletion` | blockers from platform, CONFLICT | pending |

## Shop

| Feature | Screen | Method · Path | Permission | Realtime | Cache key | Invalidates | Specific errors | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign in / session | Login, shell | POST `/shop/auth/login`, GET `/shop/auth/session`, POST `/shop/auth/logout` | public / token | — | session | everything on sign-out | INVALID_CREDENTIALS, FORBIDDEN (suspended) | served |
| Sell ticket | Terminal, Bet slip | POST `/shop/tickets` | `tickets:sell` | shop signal | — | `shop` prefix (tickets, float, transactions, shift) | ODDS_CHANGED, MARKET_SUSPENDED, STAKE_LIMITED, BET_REJECTED | served |
| Tickets / check | Open tickets, Check ticket, scanner | GET `/shop/tickets`, GET `/shop/tickets/:code` | `tickets:check` | shop signal | `shop.tickets`, `shop.ticket` | — | NOT_FOUND | served |
| Payout | Payout | POST `/shop/tickets/:code/payout` (PIN) | `tickets:payout` | shop signal | — | `shop` prefix | CONFLICT (already paid), VALIDATION/INVALID_CREDENTIALS (PIN) | served |
| Cancel | Ticket | POST `/shop/tickets/:code/cancel` (reason) | `tickets:cancel` | shop signal | — | `shop` prefix | CONFLICT | served |
| Transactions | Transactions | GET `/shop/transactions?date` | `transactions:read` | shop signal | `shop.transactions` | — | — | served |
| Reports | Daily, Trend | GET `/shop/reports/daily`, `/shop/reports/daily/range` | `reports:read` | — | `shop.reports` | — | — | served |
| Cashiers | Profile | GET `/shop/cashiers` | `cashiers:read` | — | `shop.cashiers` | — | — | served |
| Shift | Shift, Close shift | GET `/shop/shifts/current`; POST `/shop/shifts` + key; POST `/shop/shifts/:id/close` + key | `shifts:operate` | shop signal | `shop.currentShift` | `shop` prefix | CONFLICT (already open/closed), VALIDATION (PIN) | pending |
| Cash in/out | Current shift | POST `/shop/shifts/current/cash` + key | `cash:move` | shop signal | — | `shop` prefix | INSUFFICIENT_FUNDS (drawer), CONFLICT (no shift) | pending |
| Reconciliation | Reports › Shifts | GET `/shop/shifts?date` | `reports:read` | — | `shop.shifts` | — | — | pending |

## Admin

| Feature | Screen | Method · Path | Permission | Realtime | Cache key | Invalidates | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sign in / session | Login (TOTP code step), shell | POST `/admin/auth/login`, GET `/admin/auth/session`, POST `/admin/auth/logout` | public / token | — | session | everything | served (2FA enrolment and session refresh pending) |
| Dashboard | Dashboard | GET `/admin/overview`, `/admin/analytics/overview` | any admin / `reports:read` | polling | `admin.overview` | — | served |
| Users | Users | GET `/admin/users`; POST `/admin/users/:id/status` (reason) | `users:read` / `users:write` | — | `admin.list.users` | list | served |
| Shops, cashiers | Shops, Shop detail, Cashiers | `/admin/shops*`, `/admin/shops/:id/cashiers*` | `shops:*`, `cashiers:write` | — | `admin.list.*` | list, detail | served |
| Catalogue | Leagues, Teams, Fixtures | `/admin/leagues`, `/admin/teams`, `/admin/fixtures` | `catalogue:*`, `fixtures:*` | — | `admin.list.*` | list | served |
| Match control | Matches, Match control, Live control | GET `/admin/matches/:id`; POST `/admin/matches/:id/actions` (lifecycle only, reason) | `fixtures:operate` | `match:{id}` | `admin.fixture` | fixture, markets | served |
| Markets and odds | Markets, Odds config | GET `/admin/odds`, `/admin/odds/config`; PUT `/admin/odds/config`; POST `/admin/markets/:id/actions` | `odds:*` | `match:{id}` | `admin.odds` | odds | served |
| Risk | Risk | GET `/admin/risk/overview`, `/exposure`, `/limits`; PUT `/admin/risk/limits` | `risk:*` | polling | `admin.risk` | risk | served |
| Simulation | Simulation | GET `/admin/simulations`, `/admin/simulation/config`; POST `/admin/simulations/:id/actions`; PUT config | `simulation:*` | — | `admin.simulation` | list | served |
| Settlement | Settlement | GET `/admin/settlements`; POST `/admin/settlements/:id/retry` | `settlement:*` | — | `admin.list.settlements` | list | served |
| Operator ledger, commission | Wallet, Settings | GET `/admin/operator`, `/admin/operator/periods`, `/admin/commission*`, `/admin/wallet/overview`; POST `/admin/operator/periods/close`; PUT `/admin/commission/config` | `settlement:*`, `wallet:read` | — | `admin.operator` | operator | served |
| Reports and analytics | Reports (URL filters) | GET `/admin/reports/daily`, `/admin/analytics/breakdown`, `/sessions`, `/matches/:id`, `/accounts/:id`, `/shops/:id`, `/cashiers/:id` | `reports:read` | — | `admin.analytics` | — | served (full-range export pending) |
| Audit log | Audit (URL filters) | GET `/admin/audit` | `audit:read` | — | `admin.audit` | — | served |
| System health | Health | GET `/admin/health/services` | `health:read` | polling | `admin.health` | — | served |
| Settings | Settings | GET/PATCH `/admin/settings` | `settings:*` | — | `admin.settings` | settings | served |
| KYC review | KYC | GET `/admin/kyc/pending`; POST `/admin/kyc/review/:userId`; GET `/admin/kyc/documents/:id/preview` | `kyc:read` / `kyc:write` | — | `admin.kyc` | `admin.kyc` | pending |
| Payments monitoring | Payments (URL filters) | GET `/admin/payments/overview`, `/admin/payments`; POST `/admin/payments/withdrawals/:reference/review` | `payments:read` / `payments:write` | — | `admin.payments` | `admin.payments` | pending |
| Responsible gaming oversight | Responsible gaming | GET `/admin/responsible-gaming` | `users:read` | — | `admin.responsibleGaming` | — | pending |

## TV

Read-only, public routes only: `/config`, `/leagues`, `/matches`, `/odds` (displayed, never interactive), `/results`, `/leagues/:id/standings`, `/matches/:id*`, and the `matches` / `match:{id}` realtime channels. After 20 s without the live stream the screen marks its data "Out of date".
