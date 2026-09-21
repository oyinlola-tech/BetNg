# Frontend Architecture

Five clients, one domain model, one design system, one data boundary. The platform is the source of truth for everything that matters; the clients render it.

Companion documents: [`design.md`](../design.md) (visual reference), [`design-system.md`](./design-system.md) (tokens and components), [`api-integration.md`](./api-integration.md), [`realtime.md`](./realtime.md), [`testing.md`](./testing.md), [`frontend-api.md`](./frontend-api.md) (route checklist).

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
packages/mock-data       development-only stand-in for the platform, behind the same interfaces
```

Dependency direction is one way: `apps → ui-web → ui-core → client-sdk → contracts`. `mock-data` depends on `ui-core`; nothing depends on `mock-data` except each app's `services/mockSources.ts`.

## 2. Layers

```
UI component                 renders view models, owns no server data
  ↓
Feature hook                 TanStack Query: keys, stale times, invalidation
  ↓
Application service          placeBet(), session, runtime bootstrap
  ↓
Data source interface        BetNgDataSource · AuthDataSource · ShopDataSource · AdminDataSource
  ↓
Platform adapter             wire contract → view model, error translation      (or the mock, in development)
  ↓
SDK                          REST requester, realtime client
  ↓
Public gateway → services
```

Realtime flows the other way: `event service → RealtimeClient → platform data source → watchMatch / query invalidation → UI`.

What each layer may not do:

- Components and hooks never call `fetch`, never build URLs, never import the SDK or the mock.
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

1. `readClientEnv(import.meta.env)`: validated public configuration. Staging and production always resolve to the platform.
2. Create the logger and the session store.
3. Create the data sources: platform clients through `createPlatformClients`, or, in development and test only, the mock through a dynamic import that a deployed build eliminates.
4. Read `getPlatformConfig()`; apply currency and competition timezone; resolve feature flags (`platform > build overrides > defaults`).
5. Render inside `LoggerProvider`, `FeatureFlagsProvider`, `ThemeProvider`, `QueryClientProvider`, `ToastProvider` and the global error boundary.

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
- Feature flags: `virtualFootballEnabled`, `walletEnabled`, `shopEnabled`, `adminEnabled`, `liveEnabled`, `tvEnabled`, `searchEnabled`, read with `useFlag` / `FeatureGate`.

## 8. Component organisation

`packages/ui-web/src`: `ui` (primitives, tables, overlays, skeletons, states), `forms`, `feedback` (error boundaries), `teams` (crest system), `icons` (football icon set), `match` (match card, scoreboard, timeline, stats, lineups, head to head), `markets`, `betslip`, `standings`, `domain` (remaining football pieces and brand elements), `brand`, `app` (flags, logging), `providers`, `hooks`, `lib`, `styles`.

Each app keeps only what is specific to it: `configs`, `services`, `hooks`, `stores`, `layouts`, `routes`, `pages`, `features/<domain>`, `components`.

## 9. Performance

Route-level code splitting, the mock excluded from deployed bundles, variable fonts self-hosted, crests and icons as inline SVG (no image requests), query caching with stale times, realtime instead of fast polling, previous data kept while refreshing, server-driven paging for large tables. Measure before optimising further.

## 10. SEO

Public web routes set title, description, canonical and Open Graph tags per route (`useDocumentMeta`). Account, wallet, tickets and transactions are `noindex`. Shop and admin are `noindex, nofollow` at the document level.
