"""The risk analyser implementation.

This phase ships :class:`UnbuiltRiskAnalyser`, which satisfies the analyser
protocol and refuses every call with a 501.

That is deliberate. An analyser that returned `ACCEPT` for everything would be
the most dangerous kind of placeholder: the betting service would read it as
"this market has been assessed and is within limits" when nothing had been
assessed at all.
"""

from __future__ import annotations

from ..dtos import ExposureReport, ExposureRequest
from ..errors import RiskAnalysisNotBuiltError
from ..interfaces import RiskAnalyser


class UnbuiltRiskAnalyser(RiskAnalyser):
    """An analyser that refuses, pending the real model."""

    async def evaluate(self, request: ExposureRequest) -> ExposureReport:
        """Refuse to assess a market's exposure.

        Raises:
            RiskAnalysisNotBuiltError: Always.
        """
        raise RiskAnalysisNotBuiltError("an exposure report")


def create_risk_analyser() -> RiskAnalyser:
    """Create the analyser this phase ships.

    Returns:
        The analyser registered in the container.
    """
    return UnbuiltRiskAnalyser()
