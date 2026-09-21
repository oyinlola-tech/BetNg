# BETNG Design

The implementation reference for every BETNG client. Tokens live in `packages/design-tokens`, brand geometry in `packages/brand`, components in `packages/ui-web`. If this document and the code disagree, fix one of them in the same change.

## 1. Brand

BETNG is a **premium football command center**: 40% sports broadcast, 30% premium SaaS, 20% fintech, 10% editorial sports media. The match is always the subject. Promotion, decoration and status colour never compete with teams, score and state.

It must not read as a casino, a sportsbook clone, a gaming or crypto dashboard, an admin template or anything neon. No emoji anywhere; no real club marks; no copied layouts.

Signature elements, used sparingly:

- **The wordmark** `BETNG` in Archivo 800, tight tracking, with the cobalt mark. Large in the footer, small in headers.
- **The pitch line**: a 1px rule with a centre circle motif (`PitchRule`) that separates editorial sections and anchors the footer.
- **Section headings** in the `type-section` role: small, uppercase, wide tracking, preceded by a 2px brand tick. Editorial, not decorative.
- **Score-first composition**: crest, name, score; everything else is secondary.

## 2. Colour

Source: `packages/design-tokens/src/color.ts` → `--bn-*` CSS variables → Tailwind names in `ui-web/src/styles/theme.css`. Never write a hex value in a component.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | warm paper `#F5F3EE` | near black `#0A0C10` | page |
| `surface` / `surface-elevated` | `#FDFCFA` / `#FFFFFF` | `#12151B` / `#191D25` | cards, panels / popovers, dialogs |
| `surface-sunken` / `surface-hover` | `#ECE9E2` / `#F7F5F0` | `#0D1015` / `#1A1F28` | wells, table heads / hover |
| `text-primary` / `secondary` / `muted` | `#14130F` / `#4B4840` / `#696459` | `#F2F4F7` / `#B2BAC6` / `#8690A0` | three levels only |
| `border` / `border-strong` | `#E3DFD6` / `#CBC5B8` | `#222732` / `#323946` | hairlines / inputs, dividers that must read |
| `brand` | cobalt `#2457F5` | `#4C7DFF` | primary action, selection, focus, links |

Light mode is warm neutral, not white-on-grey. Dark mode is its own palette with stepped surfaces, not an inversion; pure black is never a surface.

Status colours each have a `-subtle` background partner: `success`, `warning`, `danger`, `info`, `live`, `pending`, `void`, `suspended`. Rules:

- `live` is reserved for in-play state. Nothing else is red-live.
- Status is always a word or icon **plus** colour, never colour alone.
- Status colour appears on badges, dots, left rules and icons. It is never the fill of a card, a page section or a primary button (except `danger` for destructive actions).
- Text on a filled colour is never hard-coded white: use `text-text-on-brand`, `text-text-on-live` and `text-text-on-status`, which flip to a dark ink in the dark theme where the fills are bright. `packages/design-tokens/tests/contrast.test.ts` holds every text, status and on-fill pairing to WCAG AA in both themes.
- Chart series use `series-1..3` only, assigned by position; status colours are never series colours.

Theme: Light / Dark / System via `ThemeProvider`, persisted, applied before first paint (`data-theme` on `:root`).

## 3. Typography

Inter Variable for UI, Archivo Variable for display. Every number uses tabular figures. A component picks a **role** (utility class), never a raw size.

| Role | Class | Spec |
| --- | --- | --- |
| Display | `type-display` | Archivo 800, 48, -0.02em |
| H1 / H2 / H3 | `type-h1` `type-h2` `type-h3` | Archivo 700, 30 / 24 / 17 |
| Section heading | `type-section` | Archivo 700, 12, uppercase, 0.1em |
| Body / Small | `type-body` `type-small` | Inter 400, 14 / 12 |
| Caption | `type-caption` | Inter 600, 11, uppercase, 0.08em, muted |
| Data | `type-data` | Inter 500, 14, tabular |
| Score | `type-score` + size | Archivo 800, tabular; 24 row, 40 card, 56 match header, 96 hero |
| Odds | `type-odds` | Inter 700, 14, tabular. Readable, secondary to team identity |
| Financial | `type-financial` | Inter 600, 15, tabular, right-aligned in columns |

## 4. Space, shape, elevation, motion

- Spacing scale: 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Page gutters 16 (mobile), 24 (tablet), 32 (desktop). Section gap 32–48. Card padding 12 (compact), 16 (standard), 24 (featured).
- Radius: controls 5 (`rounded-sm`), cards and panels 8 (`rounded-md`), dialogs and sheets 12 (`rounded-lg`). `rounded-full` only for dots, avatars and the live pill. No giant pills.
- Borders: 1px hairline on every card; 2px only for selection and the section tick.
- Shadow: `shadow-sm` on raised cards at most; `shadow-md` popovers; `shadow-lg` dialogs. Flat by default; borders do the work.
- Control heights 24 / 32 / 40 / 48. Touch targets ≥ 44px on coarse pointers.
- Motion 120 / 180 / 280ms. Purposeful only: score change (`animate-score-pop`), odds change (`animate-odds-up` / `animate-odds-down`, a fading tint, once), live event arrival (`animate-event-in`), panel, dialog, toast, selection. The only looping animation is the live dot. No bounce. `prefers-reduced-motion` collapses all of it.
- z-index: sticky 10, drawer 20, sheet 30, modal 40, toast 50, broadcast 60.

## 5. Icons

- **Lucide** for interface actions (home, search, user, wallet, settings, bell, calendar, filter, chevrons, arrows, trophy, clock, menu, more, download, refresh, lock, eye, plus, minus). 16px in dense UI, 20px in navigation, stroke 1.75–2.
- **Football icons** are BETNG's own set in `ui-web/src/icons/football`: `Football`, `Stadium`, `Whistle`, `Goal`, `Corner`, `YellowCard`, `RedCard`, `Substitution`, `Var`, `Formation`, `Referee`, `Kickoff`, `HalfTime`, `FullTime`, `Possession`, `Shot`, `ShotOnTarget`, `Offside`, `Foul`, `FreeKick`, `Penalty`, `PenaltyMissed`, `OwnGoal`. 24×24 viewBox, 1.75 stroke, round caps and joins, `currentColor`, no fills except cards (the card body is filled with its status colour). One `FootballIcon` component resolves an event kind to its icon via `eventIcon(kind)`.
- Every icon-only button has `aria-label`, a tooltip where the meaning is not obvious, a visible focus ring and a disabled state. Decorative icons are `aria-hidden`.

## 6. Team crests

Team identity is never an emoji or initials in a circle.

- **Licensed clubs**: `team.crest.assetUrl` supplied by the platform or asset configuration renders as an image. No club asset is bundled.
- **Virtual teams**: the BETNG crest system in `packages/brand/src/crest`. A crest is a `CrestSpec`: `shape` (shield, heater, round, hex, pennant, diamond, square-notch, oval) × `pattern` (solid, halves, quarters, stripes, hoops, sash, chevron, saltire, band, border) × `emblem` (star, crown, tower, bolt, anchor, wings, tree, wave, sun, ball, key, arrow) in primary / secondary / accent colours. The spec comes from `team.crest` when the platform supplies one; otherwise `crestFor(team)` derives it deterministically from the team id, so every client and every viewer draws the same crest. No randomness.
- Sizes: 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Below 24 the emblem is dropped and the pattern simplified so the crest stays legible.
- Components (`ui-web/src/teams`): `TeamCrest` (the mark), `TeamAvatar` (crest on a neutral tile), `TeamBadge` (crest + short code), `TeamRow` (crest + name + trailing slot), `TeamHeader` (large crest, name, city, stadium), `TeamComparison` (home vs away with a centre slot for score or time), `TeamSelect` (searchable select), `VirtualTeamCard` (crest, name, league, form).

## 7. Navigation

- **Web header**: BETNG logo · Football · Live · Virtuals · Results · Standings · Search · Theme · Notifications · Account. One row, 56px, sticky. A secondary contextual bar below it: `LIVE NOW` count then the leagues from `useLeagues()`; league names are never hard-coded.
- **Mobile** (`< lg`): top bar with logo, search, notifications; **bottom navigation** Home · Live · Virtuals · Bets · More (More opens a sheet: Results, Standings, Wallet, Account, Settings, Help). The bet slip is a sticky summary bar above the bottom nav that opens a bottom sheet.
- **Footer**: brand-led. Large `BETNG` wordmark, the pitch-line motif, link groups Football · Virtual Football · Results · Standings / Platform · Account · Wallet · Support / Legal · Responsible use · Terms · Privacy · System status, and the simulated-platform statement.
- **Shop**: left navigation, central workspace, right slip panel (`xl`), a bottom sheet below. F-key shortcuts.
- **Admin**: grouped sidebar, breadcrumb header, Ctrl/Cmd+K jump. Drawer below `lg`.
- **TV**: no chrome beyond a slim top strip; D-pad spatial navigation.

## 8. Buttons

`Button` variants: `primary` (brand fill), `secondary` (surface + border), `outline` (transparent + strong border), `ghost`, `danger`, `success`, `link`; sizes `xs` 24, `sm` 32, `md` 40, `lg` 48; `IconButton` for icon-only; `compact` density for tables. Tactile: 1px border, subtle inner highlight, 1px press translate. Disabled is 45% opacity with `not-allowed`. Focus is the two-ring `focus-ring`. One primary action per view.

## 9. Cards

`Card` (padding `compact | standard | featured`, optional `elevated`, optional `interactive`) and `Panel` (titled section). Hairline border, 8px radius. Never nest a card in a card: inside a card use dividers and `surface-sunken` wells.

## 10. Match card

One component, `MatchCard`, with `variant`: `compact` (single row), `standard`, `featured`, `live`, `mobile`, `shop`, `tv`; and states from `match.phase`: upcoming (`SCHEDULED`, `BETTING_OPEN`, `BETTING_CLOSED`), `LIVE`, `HALFTIME`, finished (`FINISHED`, `SETTLED`), `POSTPONED`, `SUSPENDED`, `CANCELLED`, `DELAYED`, plus `MatchCard.Skeleton` and `MatchCard.Error`.

Reading order: competition · state/time → home crest, name, score → away crest, name, score → optional last event → optional market summary (1X2). The winner's name and score are `text-primary` and the loser's `text-secondary` once finished; this comes from the score the platform reported.

The minute shown is `displayClock(match.clock)`; a live match without a reported clock shows `LIVE` with no minute. No component reads kick-off time to decide a state.

## 11. Match center

Header: competition and matchday, `TeamComparison` with 80–96px crests, `type-score` 56, state pill, venue. Tabs: Overview · Timeline · Stats · Lineups · Markets · Head to Head · Table. Tabs with no data for a virtual match render their unavailable state rather than disappearing.

- `MatchTimeline`: rows keyed by event id; minute, football icon, team side alignment (home left, away right on wide screens), description, player, running score on goals. Period dividers for kick-off, half time, second half, full time.
- Stats: `StatBar` (two-sided bar), `StatComparison` (number · label · number), `StatGrid`, `StatsTable`. Possession, shots, on target, corners, fouls, offsides, cards, xG and any `extra` metrics. Absent values are omitted, never zero-filled.
- Lineups: `LineupPitch` (formation grid), `LineupList` (starting XI, substitutes, manager), `PlayerRow`. Unconfirmed and unavailable states.
- `HeadToHead`: summary bar (home wins · draws · away wins) and the meetings list.

## 12. Odds and markets

- `OddsButton`: label above, price below, 40px (32 compact). States: default, hover, focus, selected (brand fill), suspended (lock icon, `suspended` tint, disabled), unavailable (dash, disabled), changed up / down (arrow + one fading tint), loading (skeleton). `aria-pressed` for selection; the accessible name includes market, label and price.
- `MarketCard` (one market), `MarketRow` (market as a table row for shop density), `MarketGroup` (titled group), `MarketTabs` (groups as tabs, horizontally scrollable on mobile), `MarketSuspendedState`, `SelectionButton` (alias of `OddsButton` inside a market). Markets, names, statuses and prices all come from the platform; the client only lays them out by `columns` and `group`.

## 13. Bet slip

States: Empty, Populated, Submitting, Accepted, Partially accepted, Limited, Rejected, Suspended, Expired, Error. Each selection shows match, market, selection, the odds snapshot, current status and remove. Totals are labelled **Estimated return**; once accepted, the slip shows the platform's `potentialPayout`. One `clientReference` per submission attempt, reused on retry. A refusal (`REJECTED`, with reason) is a result, not an error toast.

## 14. Tables and forms

`DataTable`: sorting, client or server pagination, filter bar slot, column visibility, row actions, loading / empty / error, keyboard row navigation, responsive column hiding; below `md` a table may switch to `renderCard`. Financial columns right-aligned `type-financial`. Admin tables are server-driven (page, sort, filter in the URL).

Forms: React Hook Form + Zod, `Field` wrapper (label, hint, error, `aria-describedby`), states loading, validation error, backend field errors (`DataSourceError.detail.fields`), success, reset, dirty, unsaved-changes guard where data loss is possible.

## 15. States

Every data screen has four designed states besides success: loading (a skeleton shaped like the result: `PageSkeleton`, `MatchSkeleton`, `TableSkeleton`, `MarketSkeleton`, `WalletSkeleton`, `BetSlipSkeleton`, `ProfileSkeleton`, `AdminSkeleton`, `ShopSkeleton`), empty (icon, one sentence, optional action), error (`presentError` wording, retry where it helps, request id for support), and offline/reconnecting (`ConnectionStrip` with *Reconnecting* / *Connection lost* and *Last updated*; live data is marked stale rather than shown as current).

## 16. Mobile

Designed, not shrunk. Bottom navigation, compact match cards, horizontal market tabs, bottom sheets for slip / filters / more, sticky slip bar, card representations for tables, 44px targets, safe-area insets. Verified at 320, 375, 390, 430.

## 17. TV

Token layer `packages/design-tokens/src/tv.ts` (`--bn-tv-*`, under `data-surface="tv"`). Root font size scales with the viewport so one rem layout fills 1080p and 4K. Score 9rem, team names 2.5rem, crests 10rem hero / 3rem rows, 3rem safe area. Dark only, maximum contrast, no betting controls, no hover dependence, two-tone focus ring with slight scale. Routes: Home, Live, Match, Results, Standings, Broadcast. Scenes change on platform state; holds are only a pacing floor.

## 18. Shop

A cashier terminal: dense, fast, keyboard first. Fixed three-column frame, `MarketRow` density, numbered events, Fastbet entry, persistent slip with stake keypad presets, review-before-submit, ticket reference from the platform, printing behind a `TicketPrinter` interface.

## 19. Admin

A control plane: neutral, tabular, audited. KPIs from platform analytics, server-driven tables, every destructive action behind `ConfirmDialog` with a reason, ledgers visually separated (customer wallets · shop ledger · operator ledger). There is no control that sets a score or chooses a winner, and none may be added.

## 20. Accessibility

Semantic landmarks and heading order, keyboard operation everywhere, visible focus, native `dialog` for modal surfaces with focus return, `aria-live` for connection and toasts, tabs with `tablist` / `tab` / `tabpanel`, tables with `scope` and `aria-sort`, labelled icon buttons, 4.5:1 text contrast in both themes, no colour-only state, reduced motion honoured.
