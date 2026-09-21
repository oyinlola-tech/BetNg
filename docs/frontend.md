# BetNG Frontend

Five clients over one domain, one design system and one data boundary. Every result, price, balance and ticket state comes from the platform (or the mock standing in for it); no client computes one.

```
apps/web      Vite + React 19 + react-router 8 + Tailwind 4 + TanStack Query + Zustand + RHF/zod   discovery and betting        :4200
apps/mobile   Expo 54 + React Native 0.81 + React Navigation 7 + Zustand                            one-hand personal use        Expo
apps/tv       Vite + React 19 + Tailwind 4, spatial D-pad navigation                                broadcast, 10-foot           :4300
apps/shop     Vite + React 19 + react-router 8 + Tailwind 4 + TanStack Query + Zustand + RHF/zod   cashier terminal             :4400
apps/admin    Vite + React 19 + react-router 8 + Tailwind 4 + TanStack Query + RHF/zod             operations console           :4500

packages/design-tokens   colour (light/dark), chart series, type, spacing, radius, elevation, motion, z-index → TS + generated CSS
packages/brand           original logomark, league marks and crest geometry (no third-party marks)
packages/ui-web          shared React + Tailwind components, theme stylesheet, providers and hooks for web, shop and admin
packages/ui-core         view models, data-source interfaces, session store, clock, phases, formatters, bet-slip maths, live controller, platform adapters
packages/mock-data       deterministic virtual season + mock auth, shop and admin behind the same interfaces
packages/contracts       wire contracts (match, odds, betting, wallet, realtime, auth, shop, admin)
packages/client-sdk      REST (public, auth, shop, admin) + WebSocket clients
```

Run: `pnpm build` (packages first), then `pnpm dev:web | dev:tv | dev:shop | dev:admin | dev:mobile`. Every client defaults to the in-process mock; set `VITE_DATA_SOURCE=platform` (browser apps) or `expo.extra.dataSource` (mobile) to use the gateway. `pnpm dev` runs the platform services (`scripts/dev.mjs`, `--ts-only` / `--py-only`). `pnpm verify` builds the packages, typechecks all five clients, runs the unit tests and builds the four browser apps. Backend checklist: [`docs/frontend-api.md`](./frontend-api.md).

Demo credentials (mock mode only):

| App | Sign-in |
| --- | --- |
| Web / Mobile | `demo@betng.test` / `betng-demo`; registration verification code `123456` |
| Shop | shop `BNG-LAG-001`, users `ada` (OWNER), `tunde` (MANAGER), `bisi` (CASHIER), password `betng-demo`, PIN `1234` |
| Admin | `ops@betng.test` (SUPER_ADMIN, 2FA `246810`), `operations@betng.test`, `risk@betng.test`, `support@betng.test`, password `betng-admin` |

## 1. Architecture

- **One boundary per concern.** Screens call `BetNgDataSource` (public football data, wallet, bets), `AuthDataSource`, `ShopDataSource` or `AdminDataSource`, all declared in `packages/ui-core`. Each has a platform implementation over `@betng/client-sdk` and a mock implementation in `@betng/mock-data`. Swapping is configuration, not code.
- **View models in components.** `MatchView` joins match + fixture + league + teams; `MarketView` carries layout hints; shop and admin contracts are already display-ready and are used as they arrive.
- **Sessions.** `createSessionStore` holds one identity per app with three states (`ANONYMOUS`, `AUTHENTICATED`, `EXPIRED`), persists through the app's storage, expires itself at `expiresAt`, and is observable (`useSession`). The SDK reads the bearer token per request and reports a rejected token through `onUnauthorized`, which expires the session.
- **Errors.** `translateApiError` maps every SDK failure to a `DataSourceError` code; `presentError` turns a code into a title, message and whether retry makes sense. Screens never inspect HTTP statuses.
- **Live is a controller.** `watchMatch()` owns sequencing, gap recovery and reconnect rules; each platform wraps it in a small hook.
- **The clock is derived** from `kickoffAt`; nothing stores minutes.
- **State.** Server state in TanStack Query (web, shop, admin) or a polling `useAsync` (TV, mobile). Client state (bet slip, theme, auth dialog) in Zustand. No global store for server data.

## 2. Application structure

Browser apps share one layout: `configs/` (env), `services/` (data-source wiring), `hooks/`, `stores/`, `layouts/`, `pages/`, `routes/`, `components/` (app-specific only), `styles/app.css` (imports Tailwind, `@betng/ui-web/theme.css`, and scans `packages/ui-web/src`). Anything reusable lives in `packages/ui-web`; an app keeps a component only when its interaction genuinely differs (web's wallet-backed `BetSlip`, the shop's cashier slip).

## 3–5. Design system, colour tokens, typography

- **Tokens** in `packages/design-tokens` (`src/*.ts` is the source; `css/tokens.css` is generated as `--bn-*`; `ui-web/styles/theme.css` maps them into Tailwind's `@theme` once for all browser apps).
- **Palette.** Neutral surfaces (`background`, `surface`, `surfaceElevated`, `surfaceSunken`, `surfaceHover`), three text levels, two borders, one brand accent (cobalt `#2457F5` light / `#4C7DFF` dark), `success` / `danger` / `warning`, and `live` red reserved for in-play. Dark is its own palette (surfaces step up, borders lifted, accents re-stepped), not an inversion. Light / Dark / System, persisted, applied before first paint.
- **Chart series** `series1–3` (cobalt, orange, aqua) are validated for colour-vision separation on each theme's surface, assigned by position and never cycled; status colours are never series colours.
- **Type.** Inter for UI with tabular figures for every number; Archivo for display (scores, headings, KPI values). Scale 11–64px plus `score` 56 / `score-lg` 96. `caps-label` for metadata. Admin uses mono for ids and request ids.
- **Shape and motion.** Radius is restrained (panels 8px, controls 5px). Motion 120 / 180 / 280ms plus a 600ms broadcast overlay; `prefers-reduced-motion` collapses all of it.

## 6. Component inventory

`packages/ui-web`:

- **Primitives** Button, IconButton, Input, PasswordInput, CodeInput (PIN / OTP), Textarea, Select, SearchInput, Checkbox, RadioGroup, Switch, Tabs, Badge, StatusBadge, Avatar, Panel, SectionHeader, Spinner, Skeleton / SkeletonRows / MatchCardSkeleton.
- **Overlays** Modal, ConfirmDialog (optional required reason), Drawer, Sheet (right / bottom), Dropdown (keyboard menu, viewport-positioned), Tooltip, Toast (`ToastProvider`).
- **Data** DataTable (sort, client or server pagination, responsive column hiding, row selection, loading / empty / error), Pagination, KpiCard, ActivityFeed, TimeSeriesChart, BarChart, RankedBars, Sparkline (SVG, one axis, crosshair tooltip, legend only for ≥2 series, screen-reader table).
- **States** EmptyState, ErrorState, LoadingState, OfflineState, ConnectionStrip (connecting / reconnecting / offline), PermissionDenied, SessionExpiredState.
- **Domain** TeamBadge, PhaseBadge / LiveDot, Countdown, Scoreboard, MatchRow, LiveMatchCard, UpcomingMatchCard, MatchTimeline, StatBar / StatsPanel (possession and stat bars), LeagueTable / FormPips, OddsButton, MarketCard, PitchView, ThemeSwitcher.
- **Brand** BrandLogo (with product suffix), LeagueMark (from the league's slug; unknown slugs fall back to a neutral badge).
- **Providers and hooks** ThemeProvider / useTheme, ToastProvider / useToast, useSession, useNow, useMediaQuery, useElementWidth, `cn`, `presentError`.

App-level: web `BetSlip`, `MarketsPanel`, `LobbyMatchRow`, `ConnectionBanner`, `features/auth/*`; shop slip, ticket receipt, scanner input; admin navigation, command palette, diff view. Mobile and TV have platform-native equivalents on the same tokens and view models, including bottom navigation (mobile) and the focus indicator (TV).

## 7. Web

Home (Live Now, Starting Soon, Virtual Football competition cards, Today's Matches, Recent Results, compact Standings with league switcher, Quick Access) · Virtual Football lobby (competition selector, state filters, rows with inline 1X2 and distinct BETTING OPEN / CLOSING / BETTING CLOSED / LIVE / HALF-TIME / FULL TIME / SETTLED treatments) · Live · Match (scoreboard, pitch view with broadcast overlays, Overview / Events / Stats / Markets, theatre mode) · Results · Leagues · League · Standings · Team · My Bets / Transactions · Wallet · Notifications · Account · Settings · `/login`, `/register`, `/forgot-password` · 404. Bet slip: right rail ≥1280px, bottom sheet below; states Empty, Ready, Updating, Invalid, Submitting, Success, Failed; live price checks, odds-change acceptance, suspended-selection removal.

## 8. Mobile

Tabs Home · Live · Virtuals · Bets · Account. Stack: Match (Overview / Events / Stats / Markets), League, Standings, Results, Team, Wallet, Transactions, Notifications, Settings, Watched, and a modal Auth route (Login, Register, Verify, Forgot password, Session expired). Bet slip is a bottom sheet with a collapsed bar above the tab bar ("2 selections · potential return"). Offline / reconnecting banner on every screen. Touch targets ≥44pt.

## 9. TV

Home (hero live match, also live, next matches, results, all competitions) · Live (full-bleed pitch, score bug, lower-third overlays for goal / red / HT / FT, live events, stats, next match, match strip) · Matchday · Results · Table · Next · Auto Broadcast mode (director: live → results → table → next → live, rotating between live matches). No account, wallet or bet slip anywhere. Root font size scales with the viewport, so one rem layout fills 1080p, 1440p and 4K. Remote navigation in `navigation/spatial.ts`: arrow keys pick the geometrically nearest focusable in that direction, Enter selects, Back / Escape returns; the focus ring is a two-tone 0.45rem ring plus a slight scale and never relies on hover.

## 10. Shop

Login (shop code, username, password, PIN) → Dashboard (Today's Sales, Payouts, Net Position, Open Tickets, live matches, quick actions with F2 New Bet / F3 Check Ticket / F4 Payout / F6 Results) · Betting terminal at `betting/football | virtual | live` and `tickets/new` (leagues and filters left, dense match rows with inline 1X2 and expandable markets centre, persistent cashier slip right; slip becomes a sheet below `xl`) · Ticket (receipt view, Print / Copy / Check / New Ticket, seven ticket states) · Open Tickets · Check Ticket (large input, keyboard-wedge scanner boundary, WINNING / LOSING / OPEN / VOID / ALREADY PAID / NOT FOUND) · Results · Payout (lookup → review → confirm with amount restated and PIN → receipt; never one click) · Transactions · Daily Report · Sales · Payouts · Profile · Security.

## 11. Admin

Dashboard (KPIs, system health grid, stake vs payouts, in play, recent activity) · Users · Shops · Shop detail (Overview, Cashiers, Reports) · Cashiers · Leagues · League detail (Teams, Fixtures, Matchdays, Standings, Markets, Simulation configuration, Odds) · Teams (ratings editor with plain-language explanations) · Fixtures · Matches · Match control (information, markets, exposure, simulation state, live events, settlement, audit history) · Markets · Odds · Risk · Simulation · Live Control · Settlement · Wallet · Reports (CSV export) · Audit Logs (server pagination, filters, before / after diff) · System Health · Settings. Ctrl/Cmd+K quick jump. Match control exposes only `matchAdminActionSchema` (open / close betting, start / rerun simulation, void); there is no control that sets a score or picks a winner, and the screen says so.

## 12. Authentication boundaries

| App | Public | Needs a session |
| --- | --- | --- |
| Web, Mobile | all browsing: matches, markets, results, tables, teams | placing a bet, Wallet, My Bets, Transactions, Notifications, Account |
| TV | everything | nothing |
| Shop | login only | everything |
| Admin | login only | everything, plus a permission per area |

Web and mobile never redirect a visitor to a login wall. `requireAuth(intent)` opens the auth dialog with a line explaining why, keeps the bet slip intact, and resumes the intent after sign-in (the bet is placed, or the visitor lands on the page they wanted). Gated routes visited signed out render an in-page sign-in prompt. An expired session opens the Session expired view in place and keeps the user's route and slip. Passwords and PINs are never stored; the customer session persists in local storage (AsyncStorage on mobile), shop and admin sessions in session storage so closing the terminal signs out.

## 13. RBAC

The platform resolves `permissions: string[]` into the shop and admin sessions (`shopPermissionSchema`, `adminPermissionSchema`). Clients use it for presentation only: navigation hides areas without the read permission, direct routes render `PermissionDenied`, and action buttons without the write / operate permission are disabled with a tooltip naming what is missing. The platform enforces every permission again on each route; the mocks do the same and answer `FORBIDDEN`, so the denied paths are real in development. Shop roles: OWNER, MANAGER, CASHIER. Admin roles: SUPER_ADMIN, OPERATIONS, RISK_ANALYST, SUPPORT.

## 14. Realtime

Connection state (`CONNECTING / CONNECTED / RECONNECTING / OFFLINE`) is global: a strip on web, shop and admin, a banner on mobile, a pill on TV. `watchMatch()` reads the authoritative match, applies only `sequence = last + 1` events, re-reads on a gap and after a reconnect, and once more at full time. Lists poll (3–8s) and keep previous data while refreshing, so nothing blanks and only affected components re-render. Shop and admin sources expose `subscribe()` and the apps invalidate the matching queries on each tick. The slips re-read prices on an interval and surface odds changes and suspensions before submission.

## 15. Responsive strategy

Web: fluid grid, 1 / 2 / 3 card columns, slip rail from `xl`, hamburger below `lg`, horizontally scrolling tables, 44px targets on coarse pointers. Mobile: one column, snapping rails, primary action within thumb reach, wider cards on tablets. TV: viewport-scaled rem. Shop: three columns on desktop, icon rail and slip sheet on smaller monitors and touch terminals. Admin: sidebar collapses, becomes a drawer below `lg`; tables hide secondary columns by breakpoint and scroll.

## 16. Accessibility

Semantic landmarks and headings; native `dialog` for modal, drawer and confirm (focus trap and Escape for free) with focus returned to the opener; every control labelled; `aria-sort`, `aria-current`, `aria-live` status regions for connection and toasts; state is always a word or icon plus colour, never colour alone; visible two-ring focus style; keyboard operation throughout (menu arrows, table rows, F-key shortcuts in the shop, Ctrl/Cmd+K in admin, full remote navigation on TV); charts ship a screen-reader table; `prefers-reduced-motion` honoured; contrast checked in both themes.

## 17. Mock data

`packages/mock-data` runs a deterministic virtual season on the wall clock for the four simulation competitions (Premier League, LaLiga, Serie A, Ligue 1), read from the data source and never hard-coded in a screen. Every match is a pure function of its fixture id, released against the clock, so all five apps show the same minute of the same match. Odds come from a Poisson model on team strength with a bookmaker margin. On top of it: a simulated customer account (wallet, bets, settlement, notifications), mock auth (hashed registrations, verification, rate limiting), a mock shop (tickets that settle as matches finish, PIN payout, float ledger, reports) and a mock admin (shops, customers, ratings, exposure, simulation runs, settlements, health, audit log that records every mutation). Each mock method carries the `@endpoint` it stands in for. League names are simulation categories; club badges are generated monograms, and no real logos are used.

## 18. API integration

REST through the gateway for state, one WebSocket to the event service for live events, both via `@betng/client-sdk`. The SDK is typed from `@betng/contracts`; forms validate with zod schemas matching the contracts. Routes the gateway does not serve yet degrade to an empty state (public data) or are listed as to-implement (auth, shop, admin) in `docs/frontend-api.md`. No business rule is duplicated client-side: the slip maths is presentation, and the platform re-prices, validates and settles.

## 19. Testing

`pnpm test` (Vitest): session store (persistence, self-expiry, corrupt storage, stable snapshots), error translation, bet-slip maths, SDK requester (bearer token, 204, 401 reporting, network failure), virtual-season determinism and pricing, and the account / operations contracts (including a guard that no admin action can decide a result). The mocks for auth, shop and admin are tested for the rules the platform must also honour (role enforcement, PIN payout paid once, second factor, lockout, audit recording). `pnpm verify` adds strict typechecks and type-aware lint for all five clients and production builds of the four browser apps. Visual verification is by headless Chromium screenshots in `docs/screenshots/` across light, dark, desktop, tablet and phone widths, with scripted flows for sign-in, bet placement, RBAC denial and an audited admin action.

## 20. Verification status

`pnpm verify` on 2026-09-20, exit 0:

| Step | Result |
| --- | --- |
| Build shared packages (contracts, client-sdk, design-tokens, brand, ui-core, mock-data) | pass |
| Typecheck ui-web, web, tv, shop, admin, mobile (`tsc --noEmit`, strict, TypeScript 7.0.2) | pass |
| `pnpm lint:frontend` (ESLint 10, type-aware, React hooks rules) over the five apps and the shared packages | 0 findings |
| `vitest run` | 65 tests in 8 files, all pass |
| `vite build` for web, tv, shop, admin | pass |

Checked in a browser (headless Chromium, scripted): web sign-in, registration, verification and wrong-code paths, bet placed automatically after sign-in with the slip intact, gated pages signed out; shop sale, check, payout, second payout refused, cashier denied a report, session expiry keeping route and slip; admin 2FA sign-in, a support role denied Risk, a shop suspension appearing in the audit log, a toast rendering above an open modal; TV home and live at 1920×1080. Screenshots are in `docs/screenshots/` (`web-*`, `web-auth-*`, `tv-*`, `shop-*`, `admin-*`).

Not verified or not done:

- Mobile has been typechecked and linted but not run in Expo or on a device.
- Platform mode for auth, shop and admin is untested end to end because the gateway serves none of those routes yet; the adapters are covered by unit tests against a fake SDK.
- There are no component or browser end-to-end test suites in the repo; the scripted browser checks above were run ad hoc and are not committed.
- `pnpm lint` over the whole repository reports 45 findings, all in `apps/services`, `apps/gateway` and `packages/service-kit` (backend code, not changed here).
- The admin Audit and System Health pages were reviewed in dark only; on narrow screens the Settlement table scrolls horizontally without a pinned action column.
- Voiding a match in the mock admin does not affect the other apps, since each app runs its own in-browser mock.

ESLint setup: typescript-eslint cannot load TypeScript 7, so `tools/lint` is a workspace package whose own `typescript` is the official TS 6 side-by-side build (`@typescript/typescript6`); `eslint.config.js` imports ESLint's pieces from it. Every compile in the repo still uses TypeScript 7.
