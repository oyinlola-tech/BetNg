"""Calculate probabilities query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import CalculateProbabilitiesRequest, ProbabilityMatrixResponse


@dataclass(frozen=True)
class CalculateProbabilitiesQuery(Query[ProbabilityMatrixResponse]):
    """Asks for the score matrix of a pairing. A read: it changes nothing."""

    request: CalculateProbabilitiesRequest

    type: str = SimulationQuery.CALCULATE_PROBABILITIES
