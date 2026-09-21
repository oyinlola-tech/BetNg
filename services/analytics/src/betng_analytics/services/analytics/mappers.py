from __future__ import annotations

from datetime import datetime

from ...dtos import (
    AnalyticsBreakdownRow,
    AnalyticsOverview,
    BetLeg,
    BetRecord,
    OperatorSourceFigures,
)
from ...types import Row, Window
from ...utils import operator_result, rate, to_iso, to_iso_or_none


def to_overview(row: Row, window: Window, generated_at: datetime) -> AnalyticsOverview:
    result = operator_result(row["settled_stake"], row["payout"])

    return AnalyticsOverview(
        from_=to_iso_or_none(window.start),
        to=to_iso_or_none(window.end),
        total_matches=row["matches"],
        total_bets=row["bets"],
        # A row in `betting.bets` exists only for an accepted bet.
        accepted_bets=row["bets"],
        limited_bets=row["limited_bets"],
        rejected_bets=row["rejected_bets"],
        pending_bets=row["pending_bets"],
        settled_bets=row["winning_bets"] + row["losing_bets"] + row["void_bets"],
        winning_bets=row["winning_bets"],
        losing_bets=row["losing_bets"],
        void_bets=row["void_bets"],
        cancelled_bets=row["cancelled_bets"],
        total_stake=row["stake"],
        pending_stake=row["pending_stake"],
        settled_stake=row["settled_stake"],
        total_payout=row["payout"],
        operator_result=result,
        operator_result_rate=rate(result, row["settled_stake"]),
        customers=row["customers"],
        shops=row["shops"],
        cashiers=row["cashiers"],
        generated_at=to_iso(generated_at),
    )


def to_breakdown_row(row: Row) -> AnalyticsBreakdownRow:
    result = operator_result(row["settled_stake"], row["payout"])

    return AnalyticsBreakdownRow(
        key=row["key"],
        label=row["label"],
        bets=row["bets"],
        pending_bets=row["pending_bets"],
        winning_bets=row["winning_bets"],
        losing_bets=row["losing_bets"],
        void_bets=row["void_bets"],
        stake=row["stake"],
        payout=row["payout"],
        pending_liability=row["pending_liability"],
        operator_result=result,
        operator_result_rate=rate(result, row["settled_stake"]),
    )


def to_source_figures(row: Row, prefix: str) -> OperatorSourceFigures:
    stakes = row[f"{prefix}_gross_stakes"]
    payouts = row[f"{prefix}_gross_payouts"]

    return OperatorSourceFigures(
        settled_bets=row[f"{prefix}_settled_bets"],
        void_bets=row[f"{prefix}_void_bets"],
        gross_stakes=stakes,
        gross_payouts=payouts,
        refunded_stakes=row[f"{prefix}_refunded_stakes"],
        operator_result=operator_result(stakes, payouts),
    )


def _optional_id(value: object) -> str | None:
    return None if value is None else str(value)


def to_bet_leg(row: Row) -> BetLeg:
    return BetLeg(
        id=str(row["id"]),
        match_id=str(row["match_id"]),
        market_id=str(row["market_id"]),
        selection_id=str(row["selection_id"]),
        league_id=str(row["league_id"]),
        market_type=row["market_type"],
        selection_code=row["selection_code"],
        line=None if row["line"] is None else float(row["line"]),
        odds=float(row["odds"]),
        odds_version=row["odds_version"],
        market_label=row["market_label"],
        selection_label=row["selection_label"],
        match_label=row["match_label"],
        league_name=row["league_name"],
        kickoff_at=to_iso(row["kickoff_at"]),
        outcome=row["outcome"],
        result=row["result"],
    )


def to_bet_record(row: Row, legs: list[Row]) -> BetRecord:
    return BetRecord(
        id=str(row["id"]),
        user_id=_optional_id(row["user_id"]),
        channel=row["channel"],
        shop_id=_optional_id(row["shop_id"]),
        cashier_id=_optional_id(row["cashier_id"]),
        stake=row["stake"],
        currency=row["currency"],
        total_odds=float(row["total_odds"]),
        potential_payout=row["potential_payout"],
        status=row["status"],
        payout=row["payout"],
        risk_decision_id=_optional_id(row["risk_decision_id"]),
        placed_at=to_iso(row["placed_at"]),
        settled_at=to_iso_or_none(row["settled_at"]),
        cancelled_at=to_iso_or_none(row["cancelled_at"]),
        legs=[to_bet_leg(leg) for leg in legs],
    )
