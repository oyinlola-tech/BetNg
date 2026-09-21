"""Failures the risk service describes to its callers."""

from __future__ import annotations

from betng_service_kit import (
    NOT_FOUND,
    UPSTREAM_UNAVAILABLE,
    VALIDATION_FAILED,
    ServiceError,
)

UNAUTHENTICATED = "UNAUTHENTICATED"
FORBIDDEN = "FORBIDDEN"
DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"


class UnauthenticatedError(ServiceError):
    """No gateway-asserted admin is attached to the request."""

    def __init__(self) -> None:
        """Build the refusal."""
        super().__init__(
            "Authentication is required.", code=UNAUTHENTICATED, status_code=401
        )


class ForbiddenError(ServiceError):
    """The actor lacks the permission the route needs."""

    def __init__(self) -> None:
        """Build the refusal."""
        super().__init__(
            "You do not have permission to do this.", code=FORBIDDEN, status_code=403
        )


class MatchNotFoundError(ServiceError):
    """No match has this id."""

    def __init__(self) -> None:
        """Build the refusal."""
        super().__init__("Match not found.", code=NOT_FOUND, status_code=404)


class InvalidLimitsError(ServiceError):
    """The requested limits contradict each other."""

    def __init__(self, message: str) -> None:
        """Build the refusal with the contradiction spelled out."""
        super().__init__(message, code=VALIDATION_FAILED, status_code=422)


class DatabaseUnavailableError(ServiceError):
    """PostgreSQL could not be reached or refused the work."""

    def __init__(self) -> None:
        """Build the refusal."""
        super().__init__(
            "The database is unavailable.",
            code=DATABASE_UNAVAILABLE,
            status_code=503,
        )


class AuditUnavailableError(ServiceError):
    """The audit entry could not be written, so the change was not made."""

    def __init__(self) -> None:
        """Build the refusal."""
        super().__init__(
            "The change was not applied because its audit entry could not be written.",
            code=UPSTREAM_UNAVAILABLE,
            status_code=503,
        )
