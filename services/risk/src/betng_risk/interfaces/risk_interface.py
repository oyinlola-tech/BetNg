"""The risk service's analysis contract.

The handlers are written against this protocol, never against a concrete
analyser, so the risk model that lands in a later phase drops in behind it.

What the protocol cannot do matters as much as what it can. It returns an
*action* — accept, review, suspend — and nothing else. It has no way to alter
a bet, a price or a result. The platform controls exposure by closing or
repricing a market while it is still open, never by touching the outcome;
see `docs/architecture.md`.
"""

from __future__ import annotations

from typing import Protocol

from ..dtos import ExposureReport, ExposureRequest


class RiskAnalyser(Protocol):
    async def evaluate(self, request: ExposureRequest) -> ExposureReport:
        ...
