from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PricingConfiguration:
    version: int
    margins: dict[str, Decimal]
    min_odds: Decimal
    max_odds: Decimal


@dataclass(frozen=True)
class SelectionProbability:
    code: str
    label: str
    probability: Decimal


@dataclass(frozen=True)
class MarketProbabilities:
    type: str
    name: str
    line: Decimal | None
    selections: tuple[SelectionProbability, ...]


@dataclass(frozen=True)
class PricedSelection:
    code: str
    label: str
    probability: Decimal
    odds: Decimal


@dataclass(frozen=True)
class PricedMarket:
    type: str
    name: str
    line: Decimal | None
    selections: tuple[PricedSelection, ...]
