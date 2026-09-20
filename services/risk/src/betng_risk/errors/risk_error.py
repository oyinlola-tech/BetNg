"""Risk domain errors."""

from __future__ import annotations

from betng_service_kit import NOT_IMPLEMENTED, ServiceError


class RiskAnalysisNotBuiltError(ServiceError):
    """Raised while the risk model has not been implemented.

    The procedure names, the payload shapes and the action vocabulary are
    fixed now, so betting can be written against them. The model — limits,
    worst-case analysis, the thresholds that separate accept from suspend —
    is a later phase.

    Answering 501 is the honest response: an invented `ACCEPT` would tell the
    betting service a market is safe when nothing has assessed it.
    """

    def __init__(self, capability: str) -> None:
        """Name what cannot be produced yet."""
        super().__init__(
            f"The risk model is not implemented yet, so {capability} cannot "
            f"be produced. See docs/architecture.md.",
            code=NOT_IMPLEMENTED,
            status_code=501,
        )
