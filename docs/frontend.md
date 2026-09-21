# BETNG Frontend: Screens and Sign-ins

What each client contains, and how to sign in while developing. How it is built: [`frontend-architecture.md`](./frontend-architecture.md). How it looks: [`../design.md`](../design.md) and [`design-system.md`](./design-system.md). How it talks to the platform: [`api-integration.md`](./api-integration.md) and [`realtime.md`](./realtime.md). How it is tested: [`testing.md`](./testing.md).

| Client | Stack | Port |
| --- | --- | --- |
| `apps/web` | Vite, React 19, react-router 8, Tailwind 4, TanStack Query, Zustand, React Hook Form + Zod | 4200 |
| `apps/tv` | Vite, React 19, react-router 8, Tailwind 4, spatial D-pad navigation | 4300 |
| `apps/shop` | as web | 4400 |
| `apps/admin` | as web | 4500 |
| `apps/mobile` | Expo, React Native, React Navigation | Expo |

Every client talks to the platform by default. `VITE_DATA_SOURCE=mock` opts a development or test build into the in-process stand-in; staging and production builds ignore it and do not contain it.

## Web

| Route | Screen | Access |
| --- | --- | --- |
| `/` | Football command center: current live or next match, live matches, starting soon with prices, virtual competitions, upcoming, latest results, standings preview, quick navigation | public |
| `/live` | Live and half-time matches by competition, with last event and key stats | public |
| `/virtuals` | Virtual football lobby: competition and state filters in the URL, inline 1X2 | public |
| `/leagues`, `/leagues/:leagueId` | Competitions; one competition's fixtures, results, table, teams, scorers | public |
| `/results` | Finished matches by day or matchday, competition in the URL, winner and margin | public |
| `/standings` | League table, league and season in the URL; cards on phones | public |
| `/matches/:matchId` | Match center: Overview · Timeline · Stats · Lineups · Markets · Head to Head · Table (`?tab=`), live over the realtime stream | public |
| `/teams/:teamId` | Team header, squad, fixtures, results | public |
| `/search?q=` | Platform search results (also Ctrl/Cmd+K anywhere) | public |
| `/help` | How it works, responsible use, terms, privacy, support, system status | public |
| `/betslip` | The slip as a page (the header rail on desktop, a bottom sheet on phones) | public; placing needs a session |
| `/tickets`, `/tickets/:betId` | Bets with status filter; one ticket with the platform's reference | session |
| `/wallet`, `/transactions` | Balances, deposit and withdraw; paged, filterable ledger | session |
| `/notifications` | Notifications by day | session |
| `/account/{profile,preferences,security,sessions,notifications,activity}` | Account area | session |
| `/settings` | App preferences | public |
| `/login`, `/register`, `/forgot-password` | Sign-in flows (also a dialog that keeps the slip and resumes the action) | public |
| anything else | Not found | public |

Phones get a bottom navigation (Home · Live · Virtuals · Bets · More), a sticky slip bar above it, and bottom sheets for the slip, search and More.

## TV

Home · Board (one league's week under a shared clock) · Live · Match (`/match/:matchId`, also `/live/:matchId`) · Matchday · Results · Table · Next · Broadcast (`/broadcast`: scenes change on platform state; any screen moves there after a minute without input). Dark only, remote navigable (arrows, Enter, Back), no account, wallet or betting anywhere.

## Shop

Sign-in (shop code, username, password, PIN) → Dashboard · Football · Virtual Football (week grid, Fastbet codes) · Live · Bet Slip · New Ticket · Open Tickets · Check Ticket · Results · Payout (lookup, review, PIN, receipt) · Transactions · Daily Report · Sales · Payouts · Profile · Security. Navigation and actions follow the permissions in the platform's session (OWNER, MANAGER, CASHIER). Printing goes through a `TicketPrinter` interface; the receipt barcode is drawn only from the platform's ticket reference.

## Admin

Dashboard · Users · Shops (+ detail) · Cashiers · Leagues (+ detail) · Teams · Fixtures · Matches (+ match control) · Markets · Odds · Risk · Live Control · Simulation · Settlement · Wallet and ledgers · Reports · Audit Logs · System Health · Settings. Every figure is the platform's; a figure the contracts do not carry is shown as unavailable. Lists are paged, sorted and filtered through the URL. Every destructive action needs a confirmation and a reason. There is no control that sets a score or chooses a winner.

## Mobile

Tabs Home · Live · Virtuals · Bets · Account, with Match, League, Standings, Results, Team, Wallet, Transactions, Notifications, Settings and an auth modal. The slip is a bottom sheet with a collapsed bar above the tabs.

## Sign-ins

With the development stand-in (`VITE_DATA_SOURCE=mock`; the web, shop and admin sign-in screens list these in that mode only):

| Client | Sign-in |
| --- | --- |
| Web, mobile | `demo@betng.test` / `betng-demo`; registration code `123456` |
| Shop | shop `BNG-LAG-001`, users `ada` (owner), `tunde` (manager), `bisi` (cashier), password `betng-demo`, PIN `1234` |
| Admin | `ops@betng.test` (super admin, code `246810`), `operations@`, `risk@`, `support@betng.test`, password `betng-admin` |

Against a local platform the backend's seed provides its own accounts (see the platform README); the super admin there needs a real authenticator code.

## Screens

Recorded on 2026-09-21 with every app running against the real platform (live matches, a real customer, cashier and super admin), by `scripts/docs/capture-screens.mjs`.

### Web

<table>
  <tr><td width="50%"><img alt="Home, light" src="images/screens/web/home-light.webp"><br><sub>Home, light</sub></td><td width="50%"><img alt="Home, dark" src="images/screens/web/home-dark.webp"><br><sub>Home, dark</sub></td></tr>
  <tr><td width="50%"><img alt="Live" src="images/screens/web/live-light.webp"><br><sub>Live</sub></td><td width="50%"><img alt="Virtual football lobby" src="images/screens/web/virtuals.webp"><br><sub>Virtual football lobby</sub></td></tr>
  <tr><td width="50%"><img alt="Match center: overview" src="images/screens/web/match-overview-light.webp"><br><sub>Match center: overview</sub></td><td width="50%"><img alt="Timeline" src="images/screens/web/match-timeline.webp"><br><sub>Timeline</sub></td></tr>
  <tr><td width="50%"><img alt="Stats" src="images/screens/web/match-stats.webp"><br><sub>Stats</sub></td><td width="50%"><img alt="Lineups" src="images/screens/web/match-lineups.webp"><br><sub>Lineups</sub></td></tr>
  <tr><td width="50%"><img alt="Markets" src="images/screens/web/match-markets.webp"><br><sub>Markets</sub></td><td width="50%"><img alt="Head to head" src="images/screens/web/match-h2h.webp"><br><sub>Head to head</sub></td></tr>
  <tr><td width="50%"><img alt="Results" src="images/screens/web/results.webp"><br><sub>Results</sub></td><td width="50%"><img alt="Standings" src="images/screens/web/standings.webp"><br><sub>Standings</sub></td></tr>
  <tr><td width="50%"><img alt="Search" src="images/screens/web/search.webp"><br><sub>Search</sub></td><td width="50%"><img alt="Bet slip with an estimated return" src="images/screens/web/betslip-ready.webp"><br><sub>Bet slip with an estimated return</sub></td></tr>
  <tr><td width="50%"><img alt="Bet accepted by the platform" src="images/screens/web/betslip-accepted.webp"><br><sub>Bet accepted by the platform</sub></td><td width="50%"><img alt="Tickets" src="images/screens/web/tickets.webp"><br><sub>Tickets</sub></td></tr>
  <tr><td width="50%"><img alt="Wallet" src="images/screens/web/wallet.webp"><br><sub>Wallet</sub></td><td width="50%"><img alt="Transactions" src="images/screens/web/transactions.webp"><br><sub>Transactions</sub></td></tr>
  <tr><td width="50%"><img alt="Notifications" src="images/screens/web/notifications.webp"><br><sub>Notifications</sub></td><td width="50%"><img alt="Account" src="images/screens/web/account.webp"><br><sub>Account</sub></td></tr>
</table>

<details>
<summary>The full home page</summary>

<img alt="The whole home page, top to footer" src="images/screens/web/home-full.webp">

</details>

### Web on a phone

The web app at phone width. The native Expo client shares the view models, crests and icons; it has been typechecked and linted, not yet captured on a device.

<table>
  <tr><td width="33%"><img alt="Home" src="images/screens/mobile/home-light.webp"><br><sub>Home</sub></td><td width="33%"><img alt="Home, dark" src="images/screens/mobile/home-dark.webp"><br><sub>Home, dark</sub></td><td width="33%"><img alt="Live" src="images/screens/mobile/live-light.webp"><br><sub>Live</sub></td></tr>
  <tr><td width="33%"><img alt="Live, dark" src="images/screens/mobile/live-dark.webp"><br><sub>Live, dark</sub></td><td width="33%"><img alt="Match center" src="images/screens/mobile/match.webp"><br><sub>Match center</sub></td><td width="33%"><img alt="Standings" src="images/screens/mobile/standings.webp"><br><sub>Standings</sub></td></tr>
  <tr><td width="33%"><img alt="Sticky slip bar" src="images/screens/mobile/slip-bar.webp"><br><sub>Sticky slip bar</sub></td><td width="33%"><img alt="Slip sheet" src="images/screens/mobile/slip-sheet.webp"><br><sub>Slip sheet</sub></td><td width="33%"><img alt="More" src="images/screens/mobile/more-sheet.webp"><br><sub>More</sub></td></tr>
</table>

### TV

<table>
  <tr><td width="50%"><img alt="Home" src="images/screens/tv/home.webp"><br><sub>Home</sub></td><td width="50%"><img alt="Board" src="images/screens/tv/board.webp"><br><sub>Board</sub></td></tr>
  <tr><td width="50%"><img alt="Live" src="images/screens/tv/live.webp"><br><sub>Live</sub></td><td width="50%"><img alt="Match" src="images/screens/tv/match.webp"><br><sub>Match</sub></td></tr>
  <tr><td width="50%"><img alt="Results" src="images/screens/tv/results.webp"><br><sub>Results</sub></td><td width="50%"><img alt="Table" src="images/screens/tv/standings.webp"><br><sub>Table</sub></td></tr>
  <tr><td width="50%"><img alt="Next" src="images/screens/tv/upcoming.webp"><br><sub>Next</sub></td><td width="50%"><img alt="Auto broadcast" src="images/screens/tv/broadcast.webp"><br><sub>Auto broadcast</sub></td></tr>
</table>

### Shop

<table>
  <tr><td width="50%"><img alt="Sign-in" src="images/screens/shop/login.webp"><br><sub>Sign-in</sub></td><td width="50%"><img alt="Dashboard" src="images/screens/shop/dashboard-light.webp"><br><sub>Dashboard</sub></td></tr>
  <tr><td width="50%"><img alt="Dashboard, dark" src="images/screens/shop/dashboard-dark.webp"><br><sub>Dashboard, dark</sub></td><td width="50%"><img alt="Virtual football week grid" src="images/screens/shop/week-grid-light.webp"><br><sub>Virtual football week grid</sub></td></tr>
  <tr><td width="50%"><img alt="Week grid, dark" src="images/screens/shop/week-grid-dark.webp"><br><sub>Week grid, dark</sub></td><td width="50%"><img alt="Slip" src="images/screens/shop/slip.webp"><br><sub>Slip</sub></td></tr>
  <tr><td width="50%"><img alt="Ticket issued by the platform" src="images/screens/shop/ticket.webp"><br><sub>Ticket issued by the platform</sub></td><td width="50%"><img alt="Check ticket" src="images/screens/shop/check-ticket.webp"><br><sub>Check ticket</sub></td></tr>
</table>

### Admin

<table>
  <tr><td width="50%"><img alt="Sign-in with a second factor" src="images/screens/admin/login.webp"><br><sub>Sign-in with a second factor</sub></td><td width="50%"><img alt="Dashboard" src="images/screens/admin/dashboard-light.webp"><br><sub>Dashboard</sub></td></tr>
  <tr><td width="50%"><img alt="Dashboard, dark" src="images/screens/admin/dashboard-dark.webp"><br><sub>Dashboard, dark</sub></td><td width="50%"><img alt="Matches" src="images/screens/admin/matches.webp"><br><sub>Matches</sub></td></tr>
  <tr><td width="50%"><img alt="Match control: only the allowed operations" src="images/screens/admin/match-control.webp"><br><sub>Match control: only the allowed operations</sub></td><td width="50%"><img alt="Risk" src="images/screens/admin/risk.webp"><br><sub>Risk</sub></td></tr>
  <tr><td width="50%"><img alt="Risk, dark" src="images/screens/admin/risk-dark.webp"><br><sub>Risk, dark</sub></td><td width="50%"><img alt="Simulation" src="images/screens/admin/simulation.webp"><br><sub>Simulation</sub></td></tr>
  <tr><td width="50%"><img alt="Settlement" src="images/screens/admin/settlement.webp"><br><sub>Settlement</sub></td><td width="50%"><img alt="Wallet and ledgers" src="images/screens/admin/wallet.webp"><br><sub>Wallet and ledgers</sub></td></tr>
  <tr><td width="50%"><img alt="Reports" src="images/screens/admin/reports.webp"><br><sub>Reports</sub></td><td width="50%"><img alt="Audit log" src="images/screens/admin/audit.webp"><br><sub>Audit log</sub></td></tr>
  <tr><td width="50%"><img alt="System health" src="images/screens/admin/health.webp"><br><sub>System health</sub></td><td width="50%"><img alt="Users" src="images/screens/admin/users.webp"><br><sub>Users</sub></td></tr>
  <tr><td width="50%"><img alt="Shops" src="images/screens/admin/shops.webp"><br><sub>Shops</sub></td></tr>
</table>

### Proof


![Playwright suites across desktop, mobile and TV](images/proof/e2e-tests.webp)
