from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ..dtos import (
    AdminMarketOdds,
    AdminSelectionOdds,
    Market,
    MatchOdds,
    OddsSnapshot,
    PricingConfigurationView,
    Selection,
    SnapshotPrice,
)
from ..pricing import market_name, overround
from ..types import (
    ConfigurationRecord,
    MarketRecord,
    MatchInfo,
    SelectionExposure,
    SnapshotRecord,
)
from .serialisation import iso_timestamp, to_number

_NO_EXPOSURE = SelectionExposure(stake=0, liability=0)


def to_market(record: MarketRecord) -> Market:
    return Market(
        id=record.id,
        match_id=record.match_id,
        type=record.type,  # type: ignore[arg-type]
        status=record.status,  # type: ignore[arg-type]
        line=None if record.line is None else to_number(record.line),
        odds_version=record.odds_version,
        selections=[
            Selection(
                id=selection.id,
                market_id=selection.market_id,
                code=selection.code,
                label=selection.label,
                odds=to_number(selection.odds),
                probability=to_number(selection.probability),
            )
            for selection in record.selections
        ],
        updated_at=iso_timestamp(record.updated_at),
    )


def to_match_odds(
    match_id: str, records: list[MarketRecord], generated_at: datetime
) -> MatchOdds:
    return MatchOdds(
        match_id=match_id,
        markets=[to_market(record) for record in records],
        generated_at=iso_timestamp(generated_at),
    )


def to_snapshot(record: SnapshotRecord) -> OddsSnapshot:
    return OddsSnapshot(
        id=record.id,
        market_id=record.market_id,
        match_id=record.match_id,
        odds_version=record.odds_version,
        reason=record.reason,  # type: ignore[arg-type]
        prices=[
            SnapshotPrice(
                selection_id=str(price["selectionId"]),
                code=str(price["code"]),
                odds=float(price["odds"]),
                probability=float(price["probability"]),
            )
            for price in record.prices
        ],
        created_at=iso_timestamp(record.created_at),
    )


def to_configuration_view(record: ConfigurationRecord) -> PricingConfigurationView:
    return PricingConfigurationView(
        version=record.pricing.version,
        margins={
            name: to_number(value)  # type: ignore[misc]
            for name, value in record.pricing.margins.items()
        },
        min_odds=to_number(record.pricing.min_odds),
        max_odds=to_number(record.pricing.max_odds),
        active=record.active,
        created_at=iso_timestamp(record.created_at),
        created_by=record.created_by,
        reason=record.reason,
    )


def to_admin_market(
    record: MarketRecord,
    match: MatchInfo | None,
    opening: dict[str, Decimal],
    exposure: dict[str, SelectionExposure],
) -> AdminMarketOdds:
    selections = [
        AdminSelectionOdds(
            selection_id=selection.id,
            label=selection.label,
            current_odds=to_number(selection.odds),
            opening_odds=to_number(opening.get(selection.id, selection.odds)),
            model_probability=to_number(selection.probability),
            stake=exposure.get(selection.id, _NO_EXPOSURE).stake,
            liability=exposure.get(selection.id, _NO_EXPOSURE).liability,
        )
        for selection in record.selections
    ]
    margin = overround(
        [selection.odds for selection in record.selections],
        [selection.probability for selection in record.selections],
    )

    return AdminMarketOdds(
        market_id=record.id,
        match_id=record.match_id,
        match_label="" if match is None else match.label,
        league_name="" if match is None else match.league_name,
        market_type=record.type,
        market_label=market_name(record.type, record.line),
        status=record.status,  # type: ignore[arg-type]
        margin=round(float(margin), 4),
        exposure=max((selection.liability for selection in selections), default=0),
        selections=selections,
        updated_at=iso_timestamp(record.updated_at),
    )
