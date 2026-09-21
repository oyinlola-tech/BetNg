from __future__ import annotations

from betng_service_kit import CONFLICT, NOT_FOUND, UPSTREAM_UNAVAILABLE, ServiceError

UNAUTHENTICATED = "UNAUTHENTICATED"
FORBIDDEN = "FORBIDDEN"
RESULT_IMMUTABLE = "RESULT_IMMUTABLE"
SIMULATION_FAILED = "SIMULATION_FAILED"
DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"


class UnauthenticatedError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "Authentication is required.", code=UNAUTHENTICATED, status_code=401
        )


class ForbiddenError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "You do not have permission to do that.", code=FORBIDDEN, status_code=403
        )


class SimulationRunNotFoundError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "That simulation run does not exist.", code=NOT_FOUND, status_code=404
        )


class MatchNotSimulatedError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "That match has not been simulated.", code=NOT_FOUND, status_code=404
        )


class ResultImmutableError(ServiceError):
    """A committed result is final: it is never re-run, replaced or cancelled."""

    def __init__(self) -> None:
        super().__init__(
            "The match already has a result, and a result is immutable.",
            code=RESULT_IMMUTABLE,
            status_code=409,
        )


class RunActionConflictError(ServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code=CONFLICT, status_code=409)


class SimulationFailedError(ServiceError):
    """502 ``SIMULATION_FAILED``; the message never carries the cause."""

    def __init__(self) -> None:
        super().__init__(
            "The simulation failed and no result was committed.",
            code=SIMULATION_FAILED,
            status_code=502,
        )


class DatabaseUnavailableError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "The database is unavailable.",
            code=DATABASE_UNAVAILABLE,
            status_code=503,
        )


class AuditUnavailableError(ServiceError):
    """A configuration change is refused when its audit entry cannot be written."""

    def __init__(self) -> None:
        super().__init__(
            "The change was not applied because its audit entry could not be written.",
            code=UPSTREAM_UNAVAILABLE,
            status_code=503,
        )


class InvalidConfigurationError(ServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="VALIDATION_FAILED", status_code=422)
