# BetNG Frontend

Three purpose-built clients over one domain and one data boundary.

```
apps/web      Vite + React 19 + react-router 8 + Tailwind 4 + TanStack Query + Zustand   (desktop-first control room)
apps/mobile   Expo 54 + React Native 0.81 + React Navigation 7 + Zustand                   (one-hand, touch-first)
apps/tv       Vite + React 19 + react-router 8 + Tailwind 4, remote/D-pad navigation      (broadcast, 10-foot)

packages/design-tokens   colours (light/dark), type scale, spacing, radius, elevation, motion, z-index → TS + generated CSS
packages/ui-core         view models, BetNgDataSource boundary, clock, phases, formatters, bet-slip maths, standings, live controller, platform adapter
packages/mock-data       deterministic virtual season on the wall clock, behind the same boundary (annotated with the routes it mirrors)
packages/contracts       wire contracts (extended additively: events, stats, standings, scorers, notifications, market kinds, bet-leg labels)
packages/client-sdk      REST + WebSocket clients (extended with the new routes)
```

Run: `pnpm build` (packages first), then `pnpm dev:web` (http://localhost:4200), `pnpm dev:tv` (http://localhost:4300), `pnpm dev:mobile` (Expo). All three default to the in-process mock season; set `VITE_DATA_SOURCE=platform` / `expo.extra.dataSource` to use the gateway. Backend checklist: [`docs/frontend-api.md`](./frontend-api.md).

## 1. Architecture

- **One boundary.** Screens call `BetNgDataSource` only. `createPlatformDataSource` joins the gateway's contracts into view models; the mock implements the same interface. Swapping is configuration.
- **View models, not contracts, in components.** `MatchView` joins match + fixture + league + teams; `MarketView` carries layout hints (`columns`); `BetView` carries readable legs. Components never see ids they have to resolve.
- **Live is a controller, not a hook.** `watchMatch()` in ui-core holds the reconnection rules; each platform wraps it in a ~30-line hook.
- **The clock is derived.** `matchClock(kickoffAt, now)` is pure; a ticker re-renders, nothing stores minutes.
- **State.** Server state via TanStack Query (web) or a polling `useAsync` (TV, mobile — kept dependency-light). Client state (bet slip, theme) in Zustand with persistence. No global store for data.

## 2. Web screen inventory

Home · Virtual Football lobby (league/state filters, grouped by matchday) · Live · Match (scoreboard, pitch view with score bug + broadcast overlays, Events/Stats/Table panel, live match strip, markets, full timeline, theatre mode) · Results (by day / by matchday, season selector) · Result detail (same Match page in report state) · Leagues · League (table, fixtures, results, top scorers) · Standings · Team (stats, squad, form, fixtures) · History (bets, watched, transactions) · Wallet (simulated deposit/withdraw) · Notifications · Settings (theme, notification prefs, platform info, dev controls) · 404. Persistent bet slip: right rail ≥1280px, bottom sheet below.

## 3. Mobile screen inventory

Tabs: Home · Live · Virtuals · Bets · Account. Stack: Match (Overview/Events/Stats/Markets, live match switcher, keeps scroll on updates) · League · Standings · Results · Team · Wallet · Transactions · Notifications · Settings (theme, notifications, dev controls) · Watched. Bet slip: bottom sheet plus a floating slip bar above the tab bar whenever there are selections. Offline/reconnecting banner at the top of every screen.

## 4. TV screen inventory

Home (broadcast lobby: hero live match, also-live, next matches, results, competitions) · Live (full-bleed pitch, score bug, lower-third overlays for goal/red/HT/FT, live events, stats, next match, match strip) · Live index (auto-picks the first live match) · Matchday · Results (FINAL boards) · Table · Next (countdowns) · Broadcast mode (director: live → results → table → next → live) · Connection pill (non-blocking) · light/dark.

## 5–10. Design system

Tokens in `packages/design-tokens` (`src/*.ts` is the source; `css/tokens.css` is generated as `--bn-*` variables; Tailwind maps them in each app's `@theme`). Palette: neutral surfaces, one brand accent (cobalt `#2457F5` light / `#4C7DFF` dark), `live` red reserved for in-play, success/danger/warning. Dark is a separate palette (surfaces step up, borders lifted), not an inversion. Type: Inter (UI, tabular figures) + Archivo (display: scores, headings). Radius is restrained (panels 8px, controls 5px). Motion: 120/180/280 ms plus a 600 ms broadcast overlay; `prefers-reduced-motion` zeroes all durations. Components: web `components/ui` (Button, IconButton, Badge, Tabs, Skeleton, EmptyState, ErrorState, Modal, Sheet, Input, Select, Switch, SectionHeader) and `components/domain` (TeamBadge, PhaseBadge, Countdown, Scoreboard, MatchRow, LiveMatchCard, UpcomingMatchCard, MatchTimeline, StatBar/StatsPanel, LeagueTable/FormPips, OddsButton, MarketCard, MarketsPanel, BetSlip, PitchView, ConnectionBanner, ThemeSwitcher); mobile and TV have platform-native equivalents built on the same tokens and view models.

## 11. Responsive strategy

Web: fluid grid, 1/2/3 columns for cards, right slip rail from `xl`, hamburger nav below `lg`, tables scroll horizontally, 44px targets on touch. Mobile: one column, horizontal rails with snapping, thumb-reach primary actions, tablet gets wider cards. TV: root `font-size: clamp(16px, 1.25vw, 40px)` so the same rem layout fills 1080p, 1440p and 4K.

## 12. TV remote navigation

`apps/tv/src/navigation/spatial.ts`: every interactive element is marked `data-tv-focusable`; arrow keys pick the geometrically nearest candidate in that direction (forward distance weighted, off-axis penalised); Enter clicks; Escape/Backspace/GoBack navigates back. Focus ring is a 0.45rem two-tone ring plus a 3% scale; the current match/league gets initial focus. No hover states are relied on; the cursor is hidden.

## 13. Real-time strategy

Connection state (`CONNECTING / CONNECTED / RECONNECTING / OFFLINE`) is global and shown as a banner (web, mobile) or pill (TV). `watchMatch()` reads the authoritative match, applies only `sequence = last + 1` events, re-reads on gaps and after reconnects, and re-reads once more at full time. Lists poll (3–8 s) and keep the previous data while refreshing, so nothing blanks. The SDK's socket client already reconnects with jittered backoff and re-subscribes.

## 14. Loading / empty / error states

Every list and detail has a skeleton, a specific empty state (no live matches, no results today, empty slip, no bets, no notifications, no transactions, squad unavailable…) and an `ErrorState` derived from `DataSourceError` codes (network, server, not found, betting closed, insufficient funds, validation) with retry where it helps. Settings → "Simulate connection loss" exercises the reconnect path end to end.

## 15. Mock data strategy

`packages/mock-data`: two fictional Nigerian competitions (BVPL, 12 clubs; BVC, 10 clubs) with cities, grounds, kits and generated squads. A matchday every 240 s per league, offset so something is nearly always live. Every match is a pure function of its fixture id (goals, cards, subs, corners, stats, narration), released against the clock, so web, mobile and TV show the same minute of the same match. Odds come from a Poisson model on the same strengths (7% overround, slow drift for trend arrows) and settlement evaluates each market kind against the final score. One simulated account (₦25,000 opening balance) with ledger, bets, settlement and notifications, persisted locally.

## 16. API integration boundaries

See `docs/frontend-api.md` for every route, its schema and its status. The adapter tolerates unserved optional routes and computes standings client-side until the match service does.

## 17. Implementation status

Done: tokens, ui-core, mock platform, contracts/SDK extensions, web (15 routes), TV (7 screens + director), mobile (15 screens), light/dark on all three, loading/empty/error states, reconnect handling. Verified: `tsc --noEmit` green on all apps and packages; Vite builds for web and TV; headless screenshots of web (dark/light/phone) and TV. Not verified here: mobile on a device (typecheck only). Known gaps: ESLint is broken repo-wide (typescript-eslint does not support TS 7); no automated tests yet for ui-core/mock-data; team badges are generated monograms until real kit assets exist.
