# Frontend Architecture

Five clients, one domain model, one design system, one data boundary. The platform is the source of truth for everything that matters; the clients render it.

Companion documents: [`design.md`](../design.md) (visual reference), [`design-system.md`](./design-system.md) (tokens and components), [`frontend-backend-contracts.md`](./frontend-backend-contracts.md) (contracts, authority, pending routes), [`frontend-api-matrix.md`](./frontend-api-matrix.md) (per-screen wiring), [`api-integration.md`](./api-integration.md), [`realtime.md`](./realtime.md), [`development.md`](./development.md), [`testing.md`](./testing.md), [`deployment.md`](./deployment.md), [`security-headers.md`](./security-headers.md), [`frontend-api.md`](./frontend-api.md) (route checklist).

## 1. Workspace

```
apps/web      customer web app, responsive down to 320px          Vite + React 19 + react-router 8      :4200
apps/tv       broadcast display, D-pad navigation, no betting     Vite + React 19 + react-router 8      :4300
apps/shop     cashier terminal                                    Vite + React 19 + react-router 8      :4400
apps/admin    private control plane                               Vite + React 19 + react-router 8      :4500
apps/mobile   native client                                       Expo + React Native

packages/contracts       wire contracts shared with the services (zod)
packages/client-sdk      REST client, realtime client (WebSocket / SSE)
packages/ui-core         view models, data-source interfaces, platform adapters, money, dates, clock, phase, flags, logger, env, session
packages/design-tokens   colour, type roles, spacing, radius, elevation, motion, z-index, component sizes, TV layer → TS + generated CSS
packages/brand           logo, league marks, the procedural crest system
packages/ui-web          React + Tailwind components for web, shop and admin (and TV where shared)
```

Dependency direction is one way: `apps → ui-web → ui-core → client-sdk → contracts`. There is no development stand-in: every app, in every environment, talks to the platform.

## 2. Layers

```
UI component                 renders view models, owns no server data
  ↓
Feature hook                 TanStack Query: keys, stale times, invalidation
  ↓
Application service          placeBet(), session, runtime bootstrap
  ↓
Data source interface        BetNgDataSource · AuthDataSource · AccountServicesSource · ShopDataSource · AdminDataSource · ComplianceDataSource
  ↓
Platform adapter             wire contract → view model, error translation
  ↓
SDK                          REST requester, realtime client
  ↓
Public gateway → services
```

Realtime flows the other way: `event service → RealtimeClient → platform data source → watchMatch / query invalidation → UI`.

What each layer may not do:

- Components and hooks never call `fetch`, never build URLs, never import the SDK.
- Adapters never invent data. A route that is not served yet yields an empty value and the screen shows an unavailable state.
- No layer in the browser decides a result, a price, a settlement, a balance, a payout, a risk decision, bet acceptance or an operator figure.

## 3. Canonical match

Every surface renders the same `MatchView` / `MatchSummary` (`packages/ui-core/src/types/match.type.ts`), identified only by the platform's `match.id`. There is no second match model for TV, shop or admin, and no client-generated match identity.

- `phase` is resolved from the platform's `status`, `lifecycle` and reported clock period (`resolvePhase`). Time is never an input, so two viewers can never disagree about a match's state because their clocks differ.
- `clock` is the platform's report (`period`, `minute`, `asOf`, optional `minuteLengthMs`). `displayClock` may advance the displayed minute between reports only when the platform declared a minute length, and never past the end of the reported period.
- Backend states understood: match `SCHEDULED · BETTING_OPEN · BETTING_CLOSED · IN_PLAY · COMPLETED · CANCELLED` (+ `POSTPONED · SUSPENDED · DELAYED` when supplied), presented as phases `SCHEDULED · BETTING_OPEN · BETTING_CLOSED · LIVE · HALFTIME · FINISHED · SETTLED · CANCELLED · POSTPONED · SUSPENDED · DELAYED`; markets `OPEN · SUSPENDED · CLOSED · SETTLED · VOID`; bets `PENDING · WON · LOST · VOID · CANCELLED`, and a submission's outcome `ACCEPTED · PARTIALLY_ACCEPTED · LIMITED · REJECTED · EXPIRED`. Clients never invent a transition.

## 4. State

| Kind | Where | Examples |
| --- | --- | --- |
| Server state | TanStack Query | matches, markets, odds, wallet, bets, transactions, results, standings, shop and admin data |
| Live match | `watchMatch` controller per match page | events, score, clock, connection |
| Client state | Zustand | theme, bet slip draft, navigation and sheet state, temporary filters |
| Shareable filters | URL search params | results date and competition, standings league and season, transactions filters, admin table page/sort/filter |
| Session | `createSessionStore` over `sessionStorage` | token, identity, platform-resolved permissions |

Server data is never copied into a store. Changes arrive by invalidation or realtime signal, not by optimistic writes to authoritative data.

## 5. Runtime bootstrap

Each browser app starts the same way (`src/services/runtime.ts`):

1. `readClientEnv(import.meta.env)`: validated public configuration.
2. At module load: the logger, the session store and the platform data sources (`createPlatformClients` and the `createPlatform*` adapters). Nothing here is asynchronous; tests replace the sources with `__setRuntimeForTests`.
3. `initRuntime()` reads `getPlatformConfig()`; apply currency and competition timezone; resolve feature flags (`platform > build overrides > defaults`).
4. Render inside `LoggerProvider`, `FeatureFlagsProvider`, `ThemeProvider`, `QueryClientProvider`, `ToastProvider` and the global error boundary.

## 6. Authentication and route protection

The platform authenticates; the frontend consumes. `AuthDataSource`, `ShopDataSource` and `AdminDataSource` wrap login, logout and session restoration around one observable session store with three states (`ANONYMOUS`, `AUTHENTICATED`, `EXPIRED`). The SDK reads the bearer token per request; a rejected token expires the session, the realtime connection is replaced, and the UI asks the user to sign in again while keeping their route and bet slip.

| Surface | Public | Needs a session |
| --- | --- | --- |
| Web | browsing, matches, markets, results, standings | placing a bet, tickets, wallet, transactions, notifications, account |
| TV | everything | nothing |
| Shop | sign-in | everything, by permission |
| Admin | sign-in | everything, by permission |

Guards are presentation. Permissions come only from the session the platform issued; every route and action is enforced again by the platform. 401, 403 and 404 each have a designed state.

## 7. Errors, logging, flags

- Errors: `BetNgApiError → DataSourceError → presentError`. Error boundaries at three levels: global, route (`RouteErrorBoundary` as `errorElement`) and feature (a broken widget does not take the page down).
- Logging: `createLogger` with redaction of credentials, tokens, financial detail and personal data. API failures, realtime disconnects, unhandled errors, failed user flows and long tasks are recorded. Sinks are pluggable.
- Feature flags: `virtualFootballEnabled`, `walletEnabled`, `shopEnabled`, `adminEnabled`, `liveEnabled`, `tvEnabled`, `searchEnabled`, plus the account and operations flags in section 7a, read with `useFlag` / `FeatureGate`. Resolution order: platform `/config` > build overrides > defaults.

## 7a. Customer account services

`AccountServicesSource` (`packages/ui-core/src/accountServices.type.ts`) groups what sits behind a customer session besides betting: `payments` (deposit, withdrawal, bank accounts), `kyc` (overview, BVN/NIN, document upload), `limits` (responsible gaming, self-exclusion), `security` (password, 2FA, sessions, session refresh, deletion, statements) and `devices` (notification channels, push devices). The platform adapter (`adapters/platformAccountServices.ts`) calls the routes in `frontend-backend-contracts.md`; a route the gateway does not serve yet answers `NOT_IMPLEMENTED` and the screen shows an unavailable state. Each area is also behind a flag that is off until the platform's `/config` turns it on: `paymentsEnabled`, `kycEnabled`, `responsibleGamingEnabled`, `twoFactorEnabled`, `accountSessionsEnabled`, `statementsEnabled`, `notificationChannelsEnabled`, `accountDeletionEnabled`, `cashShiftsEnabled` (shop), `complianceEnabled` (admin). `VITE_FEATURE_*` build overrides exist for staging.

Money boundaries in these flows:

- Payment providers (Paystack, Flutterwave, Bachs) are chosen and called by the backend. The browser only sees a BetNG reference and, for card payments, a hosted-checkout URL that must be https on a host in `VITE_CHECKOUT_HOSTS` before the app navigates to it.
- A deposit or withdrawal is shown as successful only when the platform reports `CONFIRMED`. The return from a provider lands on `/payments/:reference`, which polls `verifyDeposit` with backoff; a redirect is never a confirmation.
- Every money command sends an idempotency key created once per logical operation and re-sent on retry. Mutating requests are never retried automatically.
- Bank accounts are saved from a platform name enquiry (`verificationId`), never from a client-typed account name, and numbers are always masked.
- KYC files go to a short-lived upload target the platform issues, on a host in `VITE_UPLOAD_HOSTS`, with progress and cancellation; nothing is kept in web storage.

## 7b. Sessions

`createSessionMonitor` (`packages/ui-core/src/sessionMonitor.ts`) derives `ACTIVE → EXPIRING → EXPIRED` from the platform's `expiresAt`; `SessionTimeoutWarning` (ui-web) warns two minutes ahead and offers "Stay signed in" where a refresh route exists (customers; admins and cashiers are told to sign in again). On sign-out, expiry, revocation or a different user signing in, web removes every private query (`ACCOUNT_QUERY_KEYS`), and the realtime connection is replaced so private channels close. Two transports are supported: bearer tokens in `sessionStorage` (served today) and HttpOnly cookies with double-submit CSRF (`VITE_AUTH_TRANSPORT=cookie`), where nothing secret is written to web storage.

## 7c. Operational adapters

- Shop printing: `apps/shop/src/services/printing` turns tickets, payouts and shift summaries into a device-neutral receipt and prints through a `PrinterAdapter`: `BrowserPrinter` (isolated print frame), `NetworkPrinter` (ESC/POS to a local bridge on localhost only), `DevelopmentPrinter`. Selling a ticket never depends on a printer.
- Shop scanning: `apps/shop/src/services/scanner` defines `ScannerAdapter` with a keyboard-wedge implementation that never swallows normal typing; `ManualTicketEntry` is always available.
- Mobile: `apps/mobile/src/platform` holds `SecureStorage`, `Biometrics`, `PushNotifications`, `DeepLinks`, `CrashReporting` (with redaction) and `OfflineCache` (read-only fixtures, standings and results; money commands require connectivity). Where the Expo module is not installed the implementation reports itself unavailable instead of falling back to insecure storage.

## 8. Component organisation

`packages/ui-web/src`: `ui` (primitives, tables, overlays, skeletons, states), `forms`, `feedback` (error boundaries), `teams` (crest system), `icons` (football icon set), `match` (match card, scoreboard, timeline, stats, lineups, head to head), `markets`, `betslip`, `standings`, `domain` (remaining football pieces and brand elements), `brand`, `app` (flags, logging), `providers`, `hooks`, `lib`, `styles`.

Each app keeps only what is specific to it: `configs`, `services`, `hooks`, `stores`, `layouts`, `routes`, `pages`, `features/<domain>`, `components`.

## 9. Performance

Route-level code splitting, variable fonts self-hosted, crests and icons as inline SVG (no image requests), query caching with stale times, realtime instead of fast polling, previous data kept while refreshing, server-driven paging for large tables. Measure before optimising further.

## 10. SEO

Public web routes set title, description, canonical and Open Graph tags per route (`useDocumentMeta`). Account, wallet, tickets and transactions are `noindex`. Shop and admin are `noindex, nofollow` at the document level.

## Proof

Recorded on 2026-09-21. Screenshots are the apps running against the real platform; terminal images are real command output rendered by `scripts/docs/render-terminal.mjs`, and design sheets are rendered from the packages themselves by `scripts/docs/render-design-sheets.mjs`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/diagrams/frontend-layers-dark.svg">
  <img alt="Frontend layers from component to gateway" src="images/diagrams/frontend-layers-light.svg" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/diagrams/system-dark.svg">
  <img alt="The whole system" src="images/diagrams/system-light.svg" width="100%">
</picture>

`pnpm verify` builds, typechecks, lints and tests every client, builds four production bundles, and fails if any of them references a data-source switch, a stand-in or a demo credential:

![pnpm verify passing](images/proof/verify.webp)

![Unit and contract tests passing](images/proof/unit-tests.webp)

![Component and app tests passing](images/proof/component-tests.webp)

The same canonical match, seen on four surfaces from one platform:

<table>
  <tr><td width="50%"><img alt="Web match center" src="images/screens/web/match-overview-dark.webp"><br><sub>Web</sub></td><td width="50%"><img alt="TV match" src="images/screens/tv/match.webp"><br><sub>TV</sub></td></tr>
  <tr><td width="50%"><img alt="Shop dashboard" src="images/screens/shop/dashboard-light.webp"><br><sub>Shop</sub></td><td width="50%"><img alt="Admin matches" src="images/screens/admin/matches.webp"><br><sub>Admin</sub></td></tr>
</table>
