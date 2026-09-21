"""Mirrors packages/contracts; money is integer kobo, optional fields are omitted."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from ..types import BetChannel, BetStatus, Dimension, SessionKind, SubjectKind

Count = Annotated[int, Field(ge=0)]
Kobo = Annotated[int, Field(ge=0)]


class WireModel(BaseModel):
    model_config = ConfigDict(
        frozen=True, alias_generator=to_camel, populate_by_name=True
    )


class AnalyticsOverview(WireModel):
    from_: str | None = Field(default=None, serialization_alias="from")
    to: str | None = None
    total_matches: Count
    total_bets: Count
    accepted_bets: Count
    limited_bets: Count
    rejected_bets: Count
    pending_bets: Count
    settled_bets: Count
    winning_bets: Count
    losing_bets: Count
    void_bets: Count
    cancelled_bets: Count
    total_stake: Kobo
    pending_stake: Kobo
    settled_stake: Kobo
    total_payout: Kobo
    operator_result: int
    operator_result_rate: float
    customers: Count
    shops: Count
    cashiers: Count
    generated_at: str


class AnalyticsBreakdownRow(WireModel):
    key: str
    label: str
    bets: Count
    pending_bets: Count
    winning_bets: Count
    losing_bets: Count
    void_bets: Count
    stake: Kobo
    payout: Kobo
    pending_liability: Kobo
    operator_result: int
    operator_result_rate: float


class AnalyticsBreakdown(WireModel):
    by: Dimension
    from_: str | None = Field(default=None, serialization_alias="from")
    to: str | None = None
    items: list[AnalyticsBreakdownRow]


class SessionAnalysis(WireModel):
    session_id: str
    kind: SessionKind
    label: str
    starts_at: str
    ends_at: str
    bets: Count
    stake: Kobo
    payout: Kobo
    operator_result: int
    operator_result_rate: float
    customers: Count
    shops: Count
    cashiers: Count
    markets: Count
    matches: Count


class SessionAnalysisList(WireModel):
    items: list[SessionAnalysis]


class AccountAnalysis(WireModel):
    subject_kind: SubjectKind
    subject_id: str
    label: str
    bets: Count
    pending_bets: Count
    wins: Count
    losses: Count
    voids: Count
    stake: Kobo
    payout: Kobo
    net_result: int
    operator_contribution: int
    commission: Kobo | None = None
    transactions: Count | None = None


class MatchResult(WireModel):
    home_goals: Count
    away_goals: Count
    winner: Literal["HOME", "AWAY", "DRAW"]
    winning_gap: Count


class MatchAnalysis(WireModel):
    """``result`` is present only once the match is ``COMPLETED``."""

    match_id: str
    label: str
    league_id: str
    league_name: str
    season: str
    matchday: int
    kickoff_at: str
    status: str
    overview: AnalyticsOverview
    by_market: list[AnalyticsBreakdownRow]
    by_selection: list[AnalyticsBreakdownRow]
    result: MatchResult | None = None


class BetLeg(WireModel):
    id: str
    match_id: str
    market_id: str
    selection_id: str
    league_id: str
    market_type: str
    selection_code: str
    line: float | None = None
    odds: float
    odds_version: int
    market_label: str
    selection_label: str
    match_label: str
    league_name: str
    kickoff_at: str
    outcome: str
    result: str | None = None


class BetRecord(WireModel):
    id: str
    user_id: str | None = None
    channel: BetChannel
    shop_id: str | None = None
    cashier_id: str | None = None
    stake: Kobo
    currency: str
    total_odds: float
    potential_payout: Kobo
    status: BetStatus
    payout: Kobo | None = None
    risk_decision_id: str | None = None
    placed_at: str
    settled_at: str | None = None
    cancelled_at: str | None = None
    legs: list[BetLeg]


class BetPage(WireModel):
    items: list[BetRecord]
    page: Annotated[int, Field(ge=1)]
    page_size: Annotated[int, Field(ge=1)]
    total: Count


class ExposureFigures(WireModel):
    bets: Count
    stake: Kobo
    potential_payout: Kobo
    #: `SUM(potential_payout - stake)` over the pending bets counted here.
    liability: Kobo


class SelectionExposure(ExposureFigures):
    selection_id: str
    selection_code: str
    selection_label: str


class MarketExposure(ExposureFigures):
    market_id: str
    market_type: str
    market_label: str
    line: float | None = None
    selections: list[SelectionExposure]


class MatchExposure(ExposureFigures):
    match_id: str
    match_label: str
    league_id: str
    league_name: str
    kickoff_at: str
    markets: list[MarketExposure]


class ExposureReport(WireModel):
    totals: ExposureFigures
    items: list[MatchExposure]
    generated_at: str


class OperatorPeriod(WireModel):
    id: str
    kind: SessionKind
    status: Literal["OPEN", "CLOSED"]
    starts_at: str
    ends_at: str | None = None


class OperatorSummary(WireModel):
    period: OperatorPeriod
    gross_stakes: Kobo
    gross_payouts: Kobo
    operator_result: int
    operator_result_rate: float
    settled_bets: Count
    void_bets: Count
    refunded_stakes: Kobo


class OperatorSourceFigures(WireModel):
    settled_bets: Count
    void_bets: Count
    gross_stakes: Kobo
    gross_payouts: Kobo
    refunded_stakes: Kobo
    operator_result: int


class OperatorReconciliation(WireModel):
    """``reconciled`` only when bets, settlements and the ledger all agree."""

    summary: OperatorSummary
    bets: OperatorSourceFigures
    settlements: OperatorSourceFigures
    ledger: OperatorSourceFigures
    reconciled: bool
    generated_at: str


class PlatformOverview(WireModel):
    active_users: Count
    active_shops: Count
    open_bets: Count
    live_matches: Count
    today_stake: Kobo
    today_payouts: Kobo
    today_net: int
    generated_at: str


class PlatformReportDay(WireModel):
    date: str
    stake: Kobo
    payouts: Kobo
    net: int
    bets: Count
    online_stake: Kobo
    shop_stake: Kobo


class PlatformReportDayList(WireModel):
    items: list[PlatformReportDay]


class ShopCashierDay(WireModel):
    cashier_id: str
    cashier_name: str
    tickets_sold: int
    sales: int
    payouts: int


class ShopLeagueDay(WireModel):
    league_name: str
    tickets_sold: int
    sales: int


class ShopDailyReport(WireModel):
    shop_id: str
    date: str
    tickets_sold: Count
    sales: Kobo
    payouts: Kobo
    cancellations: Count
    open_tickets: Count
    net: int
    by_cashier: list[ShopCashierDay]
    by_league: list[ShopLeagueDay]


class ShopDailyReportList(WireModel):
    items: list[ShopDailyReport]
