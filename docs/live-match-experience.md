# Live match experience

How the frontends turn platform match data into the football surfaces: the
match lifecycle, the live stadium, and the market catalogue. It also records
exactly what the platform must send for each part to come alive, so nothing
here has to be guessed at.

The rule this whole layer is built on: **the platform is authoritative**. The
frontend animates events, it never invents them. There is no code path in any
surface that produces a goal, a score, a price, a result or a settlement.

## Match lifecycle

`resolvePhase` in `packages/ui-core/src/phase.ts` turns the platform's status,
lifecycle and reported clock period into one presentation phase. It takes no
time input: a match becomes live because the platform says so, never because a
kick-off time passed on this device.

```
platform status + lifecycle + clock period
                  ↓
            resolvePhase
                  ↓
SCHEDULED · BETTING_OPEN · BETTING_CLOSED · LIVE · HALFTIME
FINISHED · SETTLED · CANCELLED · POSTPONED · SUSPENDED · DELAYED
                  ↓
   isBettable · isClosed · isStarting · isLive
   isHalfTime · isFinished · isSettled
```

`bettingClosesAt` may be shown as a countdown. It is informational. Whether a
bet can be placed is `canBet(phase)` plus the market's own status, and the
platform refuses anything else regardless.

### Collections

`packages/ui-core/src/matches/collections.ts` derives every match list from the
one canonical match entity:

| Collection | Phases | Answers |
| --- | --- | --- |
| `OPEN_FOR_PLAY` | `BETTING_OPEN` | What can I play now? |
| `STARTING_SOON` | `BETTING_CLOSED`, `DELAYED` | What has just closed? |
| `LIVE` | `LIVE`, `HALFTIME` | What is happening now? |
| `UPCOMING` | `SCHEDULED` | What is later? |
| `FINISHED` | `FINISHED`, `SETTLED` | What happened? |

A match is in at most one playable collection at a time. When the platform
closes betting, the match leaves Open for play on the next read or realtime
signal and appears under Starting soon; when the platform starts it, it appears
under Live.

## Live stadium

```
REST match  ─┐
             ├─► watchMatch ─► MatchView ─► toPresentationState ─┐
realtime    ─┘   (dedupe,       (authoritative)                  │
                  gap resync)                                    ▼
                                              routeMatchEvents → PresentationEvent[]
                                                                 │
                                    ┌────────────────────────────┼───────────────┐
                                    ▼                            ▼               ▼
                              animation queue              CommentaryPanel  MatchTimeline
                                    ▼
                             Pitch · Ball · EventOverlay
```

- **Deduplication** is in `watchMatch`: events are applied by the platform's
  `sequence`, a gap triggers a resync rather than a guess, and `routeMatchEvents`
  deduplicates by event `id`, never letting an older redelivery overwrite a newer
  event.
- **The animation queue** (`animationQueue.ts`) plays one event at a time in
  sequence order. A higher-priority event interrupts a lower one, so a goal
  never waits behind the corner that led to it. It only schedules — a skipped
  animation is still in the timeline, because the timeline renders the event
  stream and not the queue.
- **Reduced motion** shortens every animation to an instant rather than removing
  events, so no information is lost.
- **Staleness**: live data older than `STALE_AFTER_MS` (20s) is reported as
  `STALE`. The stadium never presents an unfed match as though it were current.

### Pitch coordinates

One coordinate space, `packages/ui-core/src/live/pitchGeometry.ts`: `x` runs 0
(home goal line) to 100 (away goal line), `y` runs 0 to 100 across. Home attacks
towards `x = 100`. Renderers scale this into their own viewBox.

## What the platform currently supplies

Everything below works against today's contracts, with no change required:

- `MatchView.phase`, `score`, `clock`, `stats`
- `MatchEventView`: `id`, `sequence`, `kind`, `minute`, `side`, `player`,
  `secondaryPlayer`, `score`, `description`, `occurredAt`, optional `clock`
- `MatchOdds`: markets with `type`, `status`, `line`, `oddsVersion`, `selections`

With only this, the pitch shows the ball moving between the positions the laws
of the game fix after a reported event — the centre spot, a penalty spot, a
corner arc, a goal — and the commentary describes each event from the fields the
platform sent.

## What the platform would need to send for more

These are optional. Every surface renders correctly without them; each one adds
a layer rather than enabling a broken one.

### 1. Ball and player coordinates

Read from the existing `MatchEventView.detail` bag, so **no contract change is
required** — only that the producer populates these keys:

| Key | Type | Meaning |
| --- | --- | --- |
| `fromX`, `fromY` | number, 0–100 | Where the ball started |
| `toX`, `toY` | number, 0–100 | Where the ball ended |

Anything missing, non-numeric or out of range is ignored and the ball falls back
to its lawful position. It is never drawn at a guessed point.

### 2. Phase-of-play events

The pitch reads as continuous football rather than long stillness punctuated by
goals once the platform emits the build-up as events. That needs new members of
`MatchEventKind` in `packages/contracts`:

`PASS`, `DRIBBLE`, `CARRY`, `CROSS`, `SHOT_ON_TARGET`, `SAVE`, `CLEARANCE`,
`POSSESSION_CHANGED`, `ATTACK`, `COUNTER_ATTACK`, `VAR_REVIEW`, `VAR_DECISION`

The router already has severity, animation and priority slots for this shape of
event; adding the kinds is a contracts change plus a producer change in the
simulation service. **Until they exist, no frontend fabricates them.** There is
deliberately no interval-driven ball movement anywhere in the codebase.

### 3. Player positions and formation

`PlayerMarkerView` in `presentationState.ts` is the shape the pitch draws:
`id`, `side`, `name`, `shirtNumber`, `position` (a pitch point), `card`,
`sentOff`, `substituted`. The platform would supply these per match, updated as
positions change. No player is drawn that the platform did not send, and a
player is shown as sent off only because the platform reported it — never
because a red-card animation played.

### 4. Market catalogue breadth

The frontend no longer needs a release to show a new market type. Adding one to
the platform means, in order:

1. `packages/contracts/src/odds/market.type.ts` — add to `marketTypeSchema`
2. `services/odds/src/betng_odds/pricing/market_catalogue.py` — price it
3. `apps/services/settlement/src/utils/evaluation.util.ts` — grade it

**Step 3 is not optional.** A market type that reaches settlement unrecognised
is graded `VOID` and stakes are returned, which is safe but wrong.

Half-time markets (half-time result, half-time/full-time, half-time goals)
additionally need a half-time distribution from the simulation; they cannot be
derived from the full-time score matrix the odds service prices from today.

## Market catalogue

`packages/ui-core/src/markets/catalogue.ts` is presentation only: how a market
kind is named, grouped, laid out and ordered. The platform owns which markets
exist.

A kind the build does not know still renders. Its name is humanised from the
type, its group inferred from the type's wording, and its columns derived from
how many selections it has. `MarketKind` is deliberately an open type
(`KnownMarketKind | (string & {})`) so a new platform market type is data rather
than a type error.

Groups, in the order they are offered: `MAIN`, `GOALS`, `TEAMS`, `HALF`,
`SCORE`, `HANDICAP`, `SPECIALS`, `OTHER`. A group with no markets is never shown
as an empty tab, and counts come from the data.

`packages/ui-web/src/markets/registry.tsx` maps a kind to a renderer and falls
back to the generic card. Register a layout for a kind with
`registerMarketRenderer`; everything else needs no change.

### Market state is not match state

A live match may have some markets open and others suspended. The UI reads each
market's own `status`, and a suspended or closed selection cannot be added to a
slip. The platform remains the final authority on every submission.

## Surfaces

| Surface | Layout | Density |
| --- | --- | --- |
| Web `/football` | Open for play, starting soon, live, upcoming | Roomy |
| Web `/live` | Live and half-time only | Roomy |
| Web `/matches/:id` | Stadium + commentary, then tabs | Roomy |
| Shop terminal | Competitions │ workspace │ slip | Dense |
| Mobile | Play now, grouped market tabs | Compact, touch |
| TV | Large pitch, no betting | Large |

All of them render the same `MarketBoard`, the same routed event stream and the
same pitch geometry. TV draws its own pitch markings because it does not depend
on the web component library, but takes ball position and event grading from
`@betng/ui-core`, so it cannot drift from the others.

### Shop keyboard map

| Key | Action |
| --- | --- |
| `/` | Focus team search |
| `↑` `↓` | Move the cursor through matches |
| `Enter` | Open the match's market workspace |
| `Esc` | Back out of the workspace, then the expanded row, then the search |
| `F8` | Stake |
| `F9` | Review ticket |

Function keys fire from inside a field so a cashier's hands stay on the
keyboard; printable keys never fire while typing.
