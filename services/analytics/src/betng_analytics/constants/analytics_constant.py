from __future__ import annotations

from typing import Final

#: Dimensions read from a bet's legs. A bet with legs under several keys is
#: counted once under each of them, so only singles sum back to the overview.
LEG_DIMENSIONS: Final[frozenset[str]] = frozenset(
    {"league", "match", "market", "selection", "market_id", "selection_id"}
)

REPORTS_READ: Final = "reports:read"

ACTOR_ADMIN: Final = "ADMIN"
ACTOR_CASHIER: Final = "CASHIER"

#: Breakdown key for a bet that lacks the dimension, e.g. an online bet's shop.
NO_KEY: Final = "none"

DEFAULT_BREAKDOWN_LIMIT: Final = 100
MAX_BREAKDOWN_LIMIT: Final = 500
DEFAULT_PAGE_SIZE: Final = 20
MAX_PAGE_SIZE: Final = 100

#: A customer counts as active while their last activity is this recent.
ACTIVE_USER_WINDOW_MINUTES: Final = 15

MAX_REPORT_DAYS: Final = 366

DEFAULT_REPORT_DAYS: Final = 7


class AnalyticsQueryType:
    GET_OVERVIEW: Final = "analytics.getOverview"
    LIST_BETS: Final = "analytics.listBets"
    GET_MATCH_ANALYSIS: Final = "analytics.getMatchAnalysis"
    GET_EXPOSURE: Final = "analytics.getExposure"
    GET_OPERATOR_SUMMARY: Final = "analytics.getOperatorSummary"
    GET_PLATFORM_OVERVIEW: Final = "analytics.getPlatformOverview"
    LIST_DAILY_REPORTS: Final = "analytics.listDailyReports"
    GET_BREAKDOWN: Final = "analytics.getBreakdown"
    LIST_SESSIONS: Final = "analytics.listSessions"
    GET_ACCOUNT_ANALYSIS: Final = "analytics.getAccountAnalysis"
    LIST_SHOP_DAILY_REPORTS: Final = "analytics.listShopDailyReports"
