"""The pure pricing pipeline: score matrix, market probabilities, margin, odds.

Nothing in this package performs I/O or knows who is asking, so the same
inputs always give the same prices.
"""

from .margin import (
    MissingMarginError,
    overround,
    price_market,
    price_markets,
    price_selection,
)
from .market_catalogue import MARKET_TYPES, build_catalogue, market_name
from .market_probability import InvalidScoreMatrixError, derive_market_probabilities
from .pricing_type import (
    MarketProbabilities,
    PricedMarket,
    PricedSelection,
    PricingConfiguration,
    SelectionProbability,
)

__all__ = [
    "MARKET_TYPES",
    "InvalidScoreMatrixError",
    "MarketProbabilities",
    "MissingMarginError",
    "PricedMarket",
    "PricedSelection",
    "PricingConfiguration",
    "SelectionProbability",
    "build_catalogue",
    "derive_market_probabilities",
    "market_name",
    "overround",
    "price_market",
    "price_markets",
    "price_selection",
]
