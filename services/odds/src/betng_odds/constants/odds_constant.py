from __future__ import annotations

from typing import Final


class OddsCommand:
    PUBLISH_MARKETS: Final = "odds.publishMarkets"
    SET_MATCH_MARKETS_STATUS: Final = "odds.setMatchMarketsStatus"
    APPLY_MARKET_ACTION: Final = "odds.applyMarketAction"
    UPDATE_PRICING_CONFIGURATION: Final = "odds.updatePricingConfiguration"
    RECALCULATE_ODDS: Final = "odds.recalculateOdds"


class OddsQuery:
    GET_MATCH_ODDS: Final = "odds.getMatchOdds"
    GET_BULK_ODDS: Final = "odds.getBulkOdds"
    LIST_ADMIN_ODDS: Final = "odds.listAdminOdds"
    GET_PRICING_CONFIGURATION: Final = "odds.getPricingConfiguration"
    LIST_MARKET_SNAPSHOTS: Final = "odds.listMarketSnapshots"


class OddsProcedure:
    PUBLISH_MARKETS: Final = "odds.publishMarkets"
    SET_MATCH_MARKETS_STATUS: Final = "odds.setMatchMarketsStatus"
    RECALCULATE_ODDS: Final = "odds.recalculateOdds"


class PeerProcedure:
    CALCULATE_PROBABILITIES: Final = "simulation.calculateProbabilities"
    PUBLISH_EVENT: Final = "event.publish"
    RECORD_AUDIT: Final = "identity.recordAudit"


class OddsPermission:
    """Permissions the admin routes re-check."""

    READ: Final = "odds:read"
    WRITE: Final = "odds:write"


class MarketStatusValue:
    OPEN: Final = "OPEN"
    SUSPENDED: Final = "SUSPENDED"
    CLOSED: Final = "CLOSED"
    SETTLED: Final = "SETTLED"
    VOID: Final = "VOID"


class SnapshotReasonValue:
    INITIAL: Final = "INITIAL"
    STATUS_CHANGE: Final = "STATUS_CHANGE"
    GOAL: Final = "GOAL"
    RED_CARD: Final = "RED_CARD"
    HALF_TIME: Final = "HALF_TIME"
    SECOND_HALF: Final = "SECOND_HALF"


class AuditAction:
    """Audit actions of docs/architecture.md §9 that belong to odds."""

    MARKET_SUSPENDED: Final = "market_suspended"
    MARKET_RESUMED: Final = "market_resumed"
    CONFIGURATION_CHANGED: Final = "odds_configuration_changed"


ODDS_UPDATED_EVENT: Final = "ODDS_UPDATED"

#: Target status -> statuses it may replace. A suspension survives the
#: scheduler's OPEN (only RESUME lifts it); VOID is terminal.
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

#: Lifecycles (docs/architecture.md §5) before betting closes.
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
SNAPSHOT_HISTORY_LIMIT: Final = 500
