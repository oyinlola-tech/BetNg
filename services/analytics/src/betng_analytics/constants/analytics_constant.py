from __future__ import annotations

from typing import Final

#: Dimensions read from a bet's legs. A bet with legs under several keys is
#: counted once under each of them, so only singles sum back to the overview.
LEG_DIMENSIONS: Final[frozenset[str]] = frozenset(
    {"league", "match", "market", "selection", "market_id", "selection_id"}
)

#: The permission `adminPermissionSchema` and `shopPermissionSchema` both name
#: for reading reports.
REPORTS_READ: Final = "reports:read"

ACTOR_ADMIN: Final = "ADMIN"
ACTOR_CASHIER: Final = "CASHIER"

#: The key a breakdown row carries when the dimension is absent on the bet:
#: an online bet has no shop or cashier, a walk-in ticket has no customer.
NO_KEY: Final = "none"

DEFAULT_BREAKDOWN_LIMIT: Final = 100
MAX_BREAKDOWN_LIMIT: Final = 500
DEFAULT_PAGE_SIZE: Final = 20
MAX_PAGE_SIZE: Final = 100

#: A customer counts as active while their last activity is this recent.
ACTIVE_USER_WINDOW_MINUTES: Final = 15

#: The longest day range one report request may span.
MAX_REPORT_DAYS: Final = 366

#: Daily reports default to this many days ending today.
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
