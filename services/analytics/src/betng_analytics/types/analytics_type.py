from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

Row = dict[str, Any]

Dimension = Literal[
    "league",
    "match",
    "market",
    "selection",
    "shop",
    "cashier",
    "customer",
    "channel",
    "hour",
    "day",
]

#: The public dimensions plus the two id-keyed ones match analysis uses.
ReaderDimension = Literal[
    "league",
    "match",
    "market",
    "selection",
    "shop",
    "cashier",
    "customer",
    "channel",
    "hour",
    "day",
    "market_id",
    "selection_id",
]

SessionKind = Literal["HOUR", "DAY", "MATCHDAY", "ROUND", "CUSTOM"]

SubjectKind = Literal["CUSTOMER", "SHOP", "CASHIER"]

BetStatus = Literal["PENDING", "WON", "LOST", "VOID", "CANCELLED"]

BetChannel = Literal["ONLINE", "SHOP"]


@dataclass(frozen=True)
class Window:
    """A half-open interval over ``placed_at``: ``start <= placed_at < end``."""

    start: datetime | None = None
    end: datetime | None = None


@dataclass(frozen=True)
class BetScope:
    window: Window = field(default_factory=Window)
    league_id: str | None = None
    match_id: str | None = None
    shop_id: str | None = None
    user_id: str | None = None
    cashier_id: str | None = None
    status: str | None = None
    channel: str | None = None


@dataclass(frozen=True)
class DayRange:
    first: date
    last: date


@dataclass(frozen=True)
class BetPageRows:
    total: int
    bets: list[Row]
    legs: list[Row]


@dataclass(frozen=True)
class MatchAnalysisRows:
    match: Row
    overview: Row
    by_market: list[Row]
    by_selection: list[Row]


@dataclass(frozen=True)
class ExposureRows:
    totals: Row
    matches: list[Row]
    markets: list[Row]
    selections: list[Row]


@dataclass(frozen=True)
class ShopDailyRows:
    days: list[Row]
    by_cashier: list[Row]
    by_league: list[Row]
