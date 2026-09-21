"""The value types the pricing pipeline passes between its stages."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PricingConfiguration:
    """One version of the book's tunables: margin per market type and bounds."""

    version: int
    margins: dict[str, Decimal]
    min_odds: Decimal
    max_odds: Decimal


@dataclass(frozen=True)
class SelectionProbability:
    """How likely one selection is, before any margin."""

    code: str
    label: str
    probability: Decimal


@dataclass(frozen=True)
class MarketProbabilities:
    """Every selection of one market with its model probability."""

    type: str
    name: str
    line: Decimal | None
    selections: tuple[SelectionProbability, ...]


@dataclass(frozen=True)
class PricedSelection:
    """A selection with the price the margin turned its probability into."""

    code: str
    label: str
    probability: Decimal
    odds: Decimal


@dataclass(frozen=True)
class PricedMarket:
    """A market ready to be stored."""

    type: str
    name: str
    line: Decimal | None
    selections: tuple[PricedSelection, ...]
