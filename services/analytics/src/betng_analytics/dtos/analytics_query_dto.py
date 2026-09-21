from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from ..constants import (
    DEFAULT_BREAKDOWN_LIMIT,
    DEFAULT_PAGE_SIZE,
    MAX_BREAKDOWN_LIMIT,
    MAX_PAGE_SIZE,
)
from ..types import BetChannel, BetStatus, Dimension, SessionKind

Limit = Annotated[int, Field(ge=1, le=MAX_BREAKDOWN_LIMIT)]
DayText = Annotated[str, Field(min_length=10, max_length=40)]


class QueryModel(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )


class WindowParams(QueryModel):
    """``from <= placed_at < to``; either bound may be absent."""

    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None


class BetsParams(WindowParams):
    status: BetStatus | None = None
    channel: BetChannel | None = None
    shop_id: UUID | None = None
    user_id: UUID | None = None
    match_id: UUID | None = None
    page: Annotated[int, Field(ge=1, le=1_000_000)] = 1
    page_size: Annotated[int, Field(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE


class ExposureParams(QueryModel):
    league_id: UUID | None = None
    match_id: UUID | None = None
    shop_id: UUID | None = None
    limit: Limit = DEFAULT_BREAKDOWN_LIMIT


class BreakdownParams(WindowParams):
    by: Dimension
    league_id: UUID | None = None
    match_id: UUID | None = None
    shop_id: UUID | None = None
    limit: Limit = DEFAULT_BREAKDOWN_LIMIT


class SessionsParams(WindowParams):
    kind: SessionKind
    league_id: UUID | None = None
    limit: Limit = DEFAULT_BREAKDOWN_LIMIT


class DailyReportParams(QueryModel):
    """``from`` and ``to`` are days (``YYYY-MM-DD``) or ISO timestamps."""

    from_: DayText | None = Field(default=None, alias="from")
    to: DayText | None = None


class ShopQueryModel(QueryModel):
    """Extras, any ``shopId`` included, are ignored: the shop is always the actor's."""

    model_config = ConfigDict(
        frozen=True,
        extra="ignore",
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ShopDailyParams(ShopQueryModel):
    date: DayText | None = None


class ShopRangeParams(ShopQueryModel):
    from_: DayText | None = Field(default=None, alias="from")
    to: DayText | None = None
