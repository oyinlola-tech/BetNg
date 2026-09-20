from __future__ import annotations

from betng_service_kit import NOT_IMPLEMENTED, ServiceError


class SimulationEngineNotBuiltError(ServiceError):
    """Raised while the simulation engine has not been implemented.

    The endpoint, its request shape and its response shape are fixed now, so
    the rest of the platform can be built against them. The mathematics that
    produces a result is a later phase.

    Answering 501 is the honest response: the route exists and the contract is
    settled, but the capability behind it does not exist yet. Returning a
    fabricated score instead would let a caller build on a result that means
    nothing.
    """

    def __init__(self, capability: str) -> None:
        super().__init__(
            f"The simulation engine is not implemented yet, so {capability} "
            f"cannot be produced. The engine lands in the match-simulation "
            f"phase; see docs/architecture.md.",
            code=NOT_IMPLEMENTED,
            status_code=501,
        )
