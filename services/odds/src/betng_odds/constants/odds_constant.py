"""Names and fixed values of the odds domain."""

from __future__ import annotations

from typing import Final


class OddsCommand:
    """Command bus message types."""

    PUBLISH_MARKETS: Final = "odds.publishMarkets"
    SET_MATCH_MARKETS_STATUS: Final = "odds.setMatchMarketsStatus"
    APPLY_MARKET_ACTION: Final = "odds.applyMarketAction"
    UPDATE_PRICING_CONFIGURATION: Final = "odds.updatePricingConfiguration"


class OddsQuery:
    """Query bus message types."""

    GET_MATCH_ODDS: Final = "odds.getMatchOdds"
    GET_BULK_ODDS: Final = "odds.getBulkOdds"
    LIST_ADMIN_ODDS: Final = "odds.listAdminOdds"
    GET_PRICING_CONFIGURATION: Final = "odds.getPricingConfiguration"
    LIST_MARKET_SNAPSHOTS: Final = "odds.listMarketSnapshots"


class OddsProcedure:
    """RPC procedures this service answers."""

    PUBLISH_MARKETS: Final = "odds.publishMarkets"
    SET_MATCH_MARKETS_STATUS: Final = "odds.setMatchMarketsStatus"


class PeerProcedure:
    """RPC procedures this service calls."""

    CALCULATE_PROBABILITIES: Final = "simulation.calculateProbabilities"
    PUBLISH_EVENT: Final = "event.publish"
    RECORD_AUDIT: Final = "identity.recordAudit"


class OddsPermission:
    """Permissions the admin routes re-check."""

    READ: Final = "odds:read"
    WRITE: Final = "odds:write"


class MarketStatusValue:
    """``odds.markets.status``."""

    OPEN: Final = "OPEN"
    SUSPENDED: Final = "SUSPENDED"
    CLOSED: Final = "CLOSED"
    SETTLED: Final = "SETTLED"
    VOID: Final = "VOID"


class SnapshotReasonValue:
    """``odds.odds_snapshots.reason``."""

    INITIAL: Final = "INITIAL"
    STATUS_CHANGE: Final = "STATUS_CHANGE"


class AuditAction:
    """Audit actions of docs/architecture.md §9 that belong to odds."""

    MARKET_SUSPENDED: Final = "market_suspended"
    MARKET_RESUMED: Final = "market_resumed"
    CONFIGURATION_CHANGED: Final = "odds_configuration_changed"


ODDS_UPDATED_EVENT: Final = "ODDS_UPDATED"

#: The statuses a match-wide status change may move a market out of. An
#: operator's suspension survives the scheduler opening the match; only RESUME
#: lifts it. SETTLED and VOID are terminal, except that a settled match can
#: still be voided.
MATCH_STATUS_SOURCES: Final[dict[str, frozenset[str]]] = {
    MarketStatusValue.OPEN: frozenset({MarketStatusValue.CLOSED}),
    MarketStatusValue.CLOSED: frozenset(
        {MarketStatusValue.OPEN, MarketStatusValue.SUSPENDED}
    ),
    MarketStatusValue.SETTLED: frozenset(
        {
            MarketStatusValue.OPEN,
            MarketStatusValue.SUSPENDED,
            MarketStatusValue.CLOSED,
        }
    ),
    MarketStatusValue.VOID: frozenset(
        {
            MarketStatusValue.OPEN,
            MarketStatusValue.SUSPENDED,
            MarketStatusValue.CLOSED,
            MarketStatusValue.SETTLED,
        }
    ),
}

#: Lifecycle states (docs/architecture.md §5) in which a match still takes bets
#: or has yet to start taking them.
BETTABLE_LIFECYCLES: Final = frozenset(
    {
        "FIXTURE_CREATED",
        "MARKETS_CREATED",
        "ODDS_PUBLISHED",
        "BETTING_OPEN",
        "BETTING_ACTIVE",
    }
)

MAX_BULK_MATCH_IDS: Final = 60
ADMIN_TRADING_MARKET_LIMIT: Final = 600
