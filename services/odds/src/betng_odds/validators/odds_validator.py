"""Validation FastAPI's declarative schemas cannot express."""

from __future__ import annotations

from uuid import UUID

from betng_service_kit import VALIDATION_FAILED, ServiceError

from ..constants import MAX_BULK_MATCH_IDS


def _invalid(message: str) -> ServiceError:
    return ServiceError(
        "The query string failed validation.",
        code=VALIDATION_FAILED,
        status_code=422,
        details=[{"path": "matchIds", "message": message}],
    )


def parse_match_ids(raw: str) -> tuple[str, ...]:
    """Parse ``matchIds=a,b,c`` into canonical UUID strings.

    Between one and ``MAX_BULK_MATCH_IDS`` ids, each a UUID; anything else is
    a 422, so the list that reaches SQL is bounded and well-formed.
    """
    parts = [part.strip() for part in raw.split(",") if part.strip()]

    if not parts:
        raise _invalid("At least one match id is required.")

    if len(parts) > MAX_BULK_MATCH_IDS:
        raise _invalid(f"At most {MAX_BULK_MATCH_IDS} match ids are accepted.")

    try:
        return tuple(str(UUID(part)) for part in parts)
    except ValueError:
        raise _invalid("Every match id must be a UUID.") from None
