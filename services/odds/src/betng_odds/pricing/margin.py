from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Final

from .pricing_type import (
    MarketProbabilities,
    PricedMarket,
    PricedSelection,
    PricingConfiguration,
)

ODDS_QUANTUM: Final = Decimal("0.01")


class MissingMarginError(KeyError):
    """The configuration has no margin for a market type being priced."""


def price_selection(
    probability: Decimal, margin: Decimal, min_odds: Decimal, max_odds: Decimal
) -> Decimal:
    implied = probability * (1 + margin)

    if implied <= 0:
        return max_odds

    odds = (1 / implied).quantize(ODDS_QUANTUM, rounding=ROUND_HALF_UP)

    return min(max(odds, min_odds), max_odds)


def price_market(
    market: MarketProbabilities, configuration: PricingConfiguration
) -> PricedMarket:
    try:
        margin = configuration.margins[market.type]
    except KeyError:
        raise MissingMarginError(market.type) from None

    return PricedMarket(
        type=market.type,
        name=market.name,
        line=market.line,
        selections=tuple(
            PricedSelection(
                code=selection.code,
                label=selection.label,
                probability=selection.probability,
                odds=price_selection(
                    selection.probability,
                    margin,
                    configuration.min_odds,
                    configuration.max_odds,
                ),
            )
            for selection in market.selections
        ),
    )


def price_markets(
    markets: tuple[MarketProbabilities, ...], configuration: PricingConfiguration
) -> tuple[PricedMarket, ...]:
    return tuple(price_market(market, configuration) for market in markets)


def overround(odds: list[Decimal], probabilities: list[Decimal]) -> Decimal:
    fair = sum(probabilities, Decimal(0))

    if fair <= 0:
        return Decimal(0)

    implied = sum((1 / price for price in odds), Decimal(0))

    return implied / fair - 1
