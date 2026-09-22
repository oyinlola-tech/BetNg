from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from ..pricing import MARKET_TYPES

MarketType = Literal[
    "MATCH_RESULT",
    "DOUBLE_CHANCE",
    "OVER_UNDER",
    "BOTH_TEAMS_TO_SCORE",
    "CORRECT_SCORE",
    "GOAL_SPREAD",
]
MarketStatus = Literal["OPEN", "SUSPENDED", "CLOSED", "SETTLED", "VOID"]
MatchMarketsStatus = Literal["OPEN", "CLOSED", "SETTLED", "VOID"]
SnapshotReason = Literal["INITIAL", "ADMIN_REPRICE", "STATUS_CHANGE"]
MarketAdminAction = Literal["SUSPEND", "RESUME"]

Rating = Annotated[float, Field(ge=0, le=100)]
Margin = Annotated[Decimal, Field(ge=0, le=Decimal("0.5"), decimal_places=4)]


class WireModel(BaseModel):
    """A response shape: camelCase on the wire, immutable in memory."""

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, frozen=True
    )


class RequestModel(WireModel):
    """A request shape. Unknown fields are refused rather than ignored."""

    model_config = ConfigDict(extra="forbid")


class TeamStrength(RequestModel):
    """What the simulation knows about a team. Never a property of a bettor."""

    attack: Rating
    defence: Rating
    midfield: Rating
    goalkeeping: Rating
    pace: Rating
    finishing: Rating
    possession: Rating
    form: Annotated[float, Field(ge=-10, le=10)]
    home_advantage: Rating


class ProbabilityMatrix(WireModel):
    home_xg: Annotated[float, Field(ge=0)]
    away_xg: Annotated[float, Field(ge=0)]
    max_goals: Annotated[int, Field(ge=1)]
    score_matrix: list[list[Annotated[float, Field(ge=0, le=1)]]]
    model_version: Annotated[str, Field(max_length=40)]
    configuration_version: Annotated[int, Field(ge=1)]


class Selection(WireModel):
    id: str
    market_id: str
    code: str
    label: str
    odds: float
    probability: float


class Market(WireModel):
    id: str
    match_id: str
    type: MarketType
    status: MarketStatus
    line: float | None = None
    odds_version: int
    selections: list[Selection]
    updated_at: str


class MatchOdds(WireModel):
    match_id: str
    markets: list[Market]
    generated_at: str


class MatchOddsList(WireModel):
    items: list[MatchOdds]


class SnapshotPrice(WireModel):
    selection_id: str
    code: str
    odds: float
    probability: float


class OddsSnapshot(WireModel):
    id: str
    market_id: str
    match_id: str
    odds_version: int
    reason: SnapshotReason
    prices: list[SnapshotPrice]
    created_at: str


class OddsSnapshotList(WireModel):
    """A market's snapshot history, oldest first."""

    items: list[OddsSnapshot]


class PublishMarketsRequest(RequestModel):
    match_id: UUID
    home: TeamStrength
    away: TeamStrength


class PublishMarketsResult(WireModel):
    match_id: str
    markets: int
    odds_version: int


class SetMatchMarketsStatusRequest(RequestModel):
    match_id: UUID
    status: MatchMarketsStatus


class SetMatchMarketsStatusResult(WireModel):
    updated: int


class RecalculateOddsResult(WireModel):
    match_id: str
    markets: int
    odds_version: int
    recalculated: bool


class AdminSelectionOdds(WireModel):
    selection_id: str
    label: str
    current_odds: float
    opening_odds: float
    model_probability: float
    stake: int
    liability: int


class AdminMarketOdds(WireModel):
    market_id: str
    match_id: str
    match_label: str
    league_name: str
    market_type: str
    market_label: str
    status: MarketStatus
    margin: float
    exposure: int
    selections: list[AdminSelectionOdds]
    updated_at: str


class AdminMarketOddsList(WireModel):
    """The answer of ``GET /admin/odds``."""

    items: list[AdminMarketOdds]


class MarketAdminActionRequest(RequestModel):
    action: MarketAdminAction
    reason: Annotated[str, Field(min_length=4, max_length=240)]


class PricingConfigurationView(WireModel):
    version: int
    margins: dict[MarketType, float]
    min_odds: float
    max_odds: float
    active: bool
    created_at: str
    created_by: str
    reason: str


class UpdatePricingConfigurationRequest(RequestModel):
    """The body of ``PUT /admin/odds/config``: a whole new version."""

    margins: dict[MarketType, Margin]
    min_odds: Annotated[Decimal, Field(gt=1, le=1000, decimal_places=2)]
    max_odds: Annotated[Decimal, Field(gt=1, le=1000, decimal_places=2)]
    reason: Annotated[str, Field(min_length=4, max_length=240)]

    @model_validator(mode="after")
    def _complete_and_ordered(self) -> UpdatePricingConfigurationRequest:
        missing = [name for name in MARKET_TYPES if name not in self.margins]

        if missing:
            raise ValueError(f"margins is missing {', '.join(missing)}")
        if self.max_odds <= self.min_odds:
            raise ValueError("maxOdds must be greater than minOdds")

        return self
