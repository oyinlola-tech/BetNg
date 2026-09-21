from __future__ import annotations

from betng_service_kit import NOT_FOUND, VALIDATION_FAILED, ServiceError

UNAUTHENTICATED = "UNAUTHENTICATED"
FORBIDDEN = "FORBIDDEN"
DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"


class UnauthenticatedError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "Authentication is required.", code=UNAUTHENTICATED, status_code=401
        )


class ForbiddenError(ServiceError):
    def __init__(self, message: str = "You may not read this report.") -> None:
        super().__init__(message, code=FORBIDDEN, status_code=403)


class SubjectNotFoundError(ServiceError):
    def __init__(self, subject: str, subject_id: str) -> None:
        super().__init__(
            f"No {subject} exists with id {subject_id}.",
            code=NOT_FOUND,
            status_code=404,
        )


class InvalidQueryError(ServiceError):
    def __init__(self, path: str, message: str) -> None:
        super().__init__(
            "The request query failed validation.",
            code=VALIDATION_FAILED,
            status_code=422,
            details=[{"path": path, "message": message}],
        )


class DatabaseUnavailableError(ServiceError):
    def __init__(self) -> None:
        super().__init__(
            "The analytics database could not be read.",
            code=DATABASE_UNAVAILABLE,
            status_code=503,
        )
