"""The risk application service.

Registers the risk read handlers on the query bus, resolving the analyser
from the container. There is no command bus: risk changes nothing.
"""

from __future__ import annotations

from betng_service_kit import Container, QueryBus

from ...constants import RISK_ANALYSER_TOKEN
from .queries import EvaluateExposureHandler


def register_risk_service(container: Container, query_bus: QueryBus) -> None:
    analyser = container.resolve(RISK_ANALYSER_TOKEN)

    query_bus.register(EvaluateExposureHandler(analyser))
