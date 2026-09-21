"""The wire shapes of the risk service.

These mirror ``packages/contracts/src/platform/risk.type.ts`` and
``riskOverviewSchema`` in ``packages/contracts/src/admin/operations.type.ts``.
They are written out again here rather than imported, because a TypeScript
package must not become a build dependency of a Python service. Attributes are
snake_case; the JSON is the contract's camelCase.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from ..engine import DecisionKind, RiskReason

#: No stake, limit or aggregate on a play-money book comes near this; anything
#: larger is refused as malformed rather than carried into arithmetic.
MAX_KOBO = 10**15

MAX_LEGS = 20

ExposureStatus = Literal["NORMAL", "ELEVATED", "CRITICAL", "FROZEN"]
RiskState = Literal["NORMAL", "ELEVATED", "CRITICAL"]


def _iso_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


IsoTimestamp = Annotated[
    datetime, PlainSerializer(_iso_timestamp, return_type=str, when_used="json")
]

#: Odds and lines travel as JSON numbers; they are decimals everywhere inside.
WireDecimal = Annotated[
    Decimal, PlainSerializer(float, return_type=float, when_used="json")
]

Kobo = Annotated[int, Field(ge=0, le=MAX_KOBO)]
PositiveKobo = Annotated[int, Field(ge=1, le=MAX_KOBO)]
Count = Annotated[int, Field(ge=0)]


class WireModel(BaseModel):
    """Base of every wire shape: camelCase JSON, immutable, no unknown keys."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        frozen=True,
        extra="forbid",
    )


class RiskActor(WireModel):
    """Who is placing the slip. Stored with the decision, never used by it."""

    kind: Literal["CUSTOMER", "CASHIER"]
    id: UUID
    shop_id: UUID | None = None


class RiskLeg(WireModel):
    """One leg of the slip, at the odds betting will store on the bet."""

    match_id: UUID
    market_id: UUID
    selection_id: UUID
    odds: Annotated[Decimal, Field(gt=1, le=1000, decimal_places=2)]


class RiskEvaluateRequest(WireModel):
    """The payload of ``risk.evaluate``."""

    actor: RiskActor
    stake: PositiveKobo
    legs: Annotated[list[RiskLeg], Field(min_length=1, max_length=MAX_LEGS)]


class RiskDecision(WireModel):
    """What risk answers before a stake is accepted."""

    decision_id: UUID
    decision: DecisionKind
    reason: RiskReason
    max_stake: Kobo


class FreezeExposureRequest(WireModel):
    """The payload of ``risk.freezeExposure``."""

    match_id: UUID


class FreezeExposureResult(WireModel):
    """When the match's exposure was frozen; the first freeze wins."""

    match_id: UUID
    frozen_at: IsoTimestamp


class RiskLimits(WireModel):
    """The limits version in force."""

    version: Annotated[int, Field(ge=1)]
    min_stake: PositiveKobo
    max_stake_per_bet: PositiveKobo
    max_payout_per_bet: PositiveKobo
    max_liability_per_selection: PositiveKobo
    max_liability_per_market: PositiveKobo
    max_liability_per_match: PositiveKobo
    updated_at: IsoTimestamp
    updated_by: Annotated[str, Field(max_length=80)] | None = None


class UpdateRiskLimitsRequest(WireModel):
    """The body of ``PUT /api/v1/admin/risk/limits``; omitted limits carry over."""

    min_stake: PositiveKobo | None = None
    max_stake_per_bet: PositiveKobo | None = None
    max_payout_per_bet: PositiveKobo | None = None
    max_liability_per_selection: PositiveKobo | None = None
    max_liability_per_market: PositiveKobo | None = None
    max_liability_per_match: PositiveKobo | None = None
    reason: Annotated[str, Field(min_length=4, max_length=240)]


class SelectionExposureRow(WireModel):
    """One selection's share of the pending book."""

    selection_id: UUID
    code: str
    label: str
    odds: WireDecimal
    bets: Count
    customers: Count
    shops: Count
    total_stake: Kobo
    potential_payout: Kobo
    #: ``potential_payout - market stake``: the book's loss on this market if
    #: this selection wins.
    net_exposure: int
    status: ExposureStatus


class MarketExposure(WireModel):
    """One market's pending book."""

    market_id: UUID
    type: str
    line: WireDecimal | None = None
    total_stake: Kobo
    worst_case_exposure: int
    selections: list[SelectionExposureRow]


class MatchExposure(WireModel):
    """One match on the exposure dashboard; every number is an aggregate."""

    match_id: UUID
    league_name: str
    match_label: str
    kickoff_at: IsoTimestamp
    lifecycle: str
    frozen_at: IsoTimestamp | None = None
    bets: Count
    total_stake: Kobo
    worst_case_exposure: int
    status: ExposureStatus
    markets: list[MarketExposure]


class MatchExposureList(WireModel):
    """The answer of ``GET /api/v1/admin/risk/exposure``."""

    items: list[MatchExposure]


class DecisionCounts(WireModel):
    """Stored decisions by kind."""

    accepted: Count
    limited: Count
    rejected: Count


class MarketTypeExposure(WireModel):
    """The pending book grouped by market type."""

    market_type: str
    market_label: str
    stake: int
    exposure: int


class MatchRiskSummary(WireModel):
    """One match's line on the overview."""

    match_id: UUID
    match_label: str
    league_name: str
    kickoff_at: IsoTimestamp
    stake: int
    exposure: int
    state: RiskState


class RiskOverview(WireModel):
    """The platform-wide view of the pending book."""

    total_stake: Kobo
    potential_payout: Kobo
    exposure: Kobo
    exposure_limit: Kobo
    state: RiskState
    decisions: DecisionCounts
    by_market: list[MarketTypeExposure]
    by_match: list[MatchRiskSummary]
    generated_at: IsoTimestamp
