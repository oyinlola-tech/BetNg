from __future__ import annotations

from betng_service_kit import CONFLICT, NOT_FOUND, UPSTREAM_UNAVAILABLE, ServiceError

UNAUTHENTICATED = "UNAUTHENTICATED"
FORBIDDEN = "FORBIDDEN"
MARKET_CLOSED = "MARKET_CLOSED"
ODDS_UNAVAILABLE = "ODDS_UNAVAILABLE"
DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"


class UnauthenticatedError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "Authentication is required.", code=UNAUTHENTICATED, status_code=401
        )


class ForbiddenError(ServiceError):
    """The actor lacks the permission the route needs."""

    def __init__(self, permission: str) -> None:
        """Build the 403 naming the missing permission."""
        super().__init__(
            f"The {permission} permission is required.",
            code=FORBIDDEN,
            status_code=403,
        )


class MarketNotFoundError(ServiceError):
    def __init__(self, market_id: str) -> None:
        super().__init__(
            f"Market {market_id} does not exist.", code=NOT_FOUND, status_code=404
        )


class MatchNotFoundError(ServiceError):
    """The ``match`` schema has no such match, so it cannot be priced."""

    def __init__(self, match_id: str) -> None:
        super().__init__(
            f"Match {match_id} does not exist.", code=NOT_FOUND, status_code=404
        )


class MarketClosedError(ServiceError):
    def __init__(self, market_id: str) -> None:
        super().__init__(
            f"Market {market_id} belongs to a match that is no longer open "
            "for betting.",
            code=MARKET_CLOSED,
            status_code=409,
        )


class MarketStateConflictError(ServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code=CONFLICT, status_code=409)


class OddsUnavailableError(ServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code=ODDS_UNAVAILABLE, status_code=503)


class AuditUnavailableError(ServiceError):
    """The audit entry could not be written, so the change was not made."""

    def __init__(self) -> None:
        super().__init__(
            "The audit entry could not be written, so the change was not applied.",
            code=UPSTREAM_UNAVAILABLE,
            status_code=503,
        )


class DatabaseUnavailableError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "The database is unavailable.",
            code=DATABASE_UNAVAILABLE,
            status_code=503,
        )
