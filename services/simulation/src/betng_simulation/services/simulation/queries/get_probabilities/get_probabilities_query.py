from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import ProbabilityRequest


@dataclass(frozen=True)
class GetProbabilitiesQuery(Query):
    """Asks for the home/draw/away probabilities of a pairing.

    A read: it computes from the teams given and changes nothing.
    """

    request: ProbabilityRequest

    type: str = SimulationQuery.GET_PROBABILITIES
