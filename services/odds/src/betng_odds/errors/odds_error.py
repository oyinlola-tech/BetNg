from __future__ import annotations

from betng_service_kit import NOT_IMPLEMENTED, ServiceError


class OddsPricingNotBuiltError(ServiceError):
    """Raised while the pricing model has not been implemented.

    The procedure names, the payload shapes and the market taxonomy are fixed
    now, so betting and the gateway can be written against them. The pricing
    mathematics — margin, market generation, in-play movement — is a later
    phase.

    Answering 501 is the honest response: publishing invented prices would let
    the betting service accept bets at odds that mean nothing.
    """

    def __init__(self, capability: str) -> None:
        super().__init__(
            f"The odds pricing model is not implemented yet, so {capability} "
            f"cannot be produced. See docs/architecture.md.",
            code=NOT_IMPLEMENTED,
            status_code=501,
        )
