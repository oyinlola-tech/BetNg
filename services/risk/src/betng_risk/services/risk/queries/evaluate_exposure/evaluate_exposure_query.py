from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import ExposureRequest


@dataclass(frozen=True)
class EvaluateExposureQuery(Query):
    """Asks for a market's worst-case liability and the action to take.

    A query rather than a command: risk analysis reads accepted stakes and
    reports. It changes nothing.
    """

    request: ExposureRequest

    type: str = RiskQuery.EVALUATE_EXPOSURE
