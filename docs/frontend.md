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
