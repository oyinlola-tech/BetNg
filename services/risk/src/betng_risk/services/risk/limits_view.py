from __future__ import annotations

from typing import Any

from ...dtos import RiskLimits
from ...types import LimitsRecord


def to_risk_limits(record: LimitsRecord) -> RiskLimits:
    limits = record.limits

    return RiskLimits(
        version=limits.version,
        min_stake=limits.min_stake,
        max_stake_per_bet=limits.max_stake_per_bet,
        max_payout_per_bet=limits.max_payout_per_bet,
        max_liability_per_selection=limits.max_liability_per_selection,
        max_liability_per_market=limits.max_liability_per_market,
        max_liability_per_match=limits.max_liability_per_match,
        updated_at=record.created_at,
        updated_by=record.created_by,
    )


def to_audit_view(record: LimitsRecord) -> dict[str, Any]:
    """Shape a limits row for an audit entry's ``before`` or ``after``."""
    limits = record.limits

    return {
        "version": limits.version,
        "minStake": limits.min_stake,
        "maxStakePerBet": limits.max_stake_per_bet,
        "maxPayoutPerBet": limits.max_payout_per_bet,
        "maxLiabilityPerSelection": limits.max_liability_per_selection,
        "maxLiabilityPerMarket": limits.max_liability_per_market,
        "maxLiabilityPerMatch": limits.max_liability_per_match,
    }
