"""The base every wire shape is built on.

JSON is camelCase on the wire and snake_case in Python, and an unknown field is
a validation error rather than something to ignore: a payload that tries to
carry a stake, a bettor or an exposure figure into this service is refused
outright instead of being silently dropped.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


class ContractModel(BaseModel):
    """camelCase on the wire; unknown fields are rejected."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
    )


def _to_iso_utc(value: datetime) -> str:
    # `z.iso.datetime()` in `@betng/contracts` accepts only the `Z` form.
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


IsoTimestamp = Annotated[datetime, PlainSerializer(_to_iso_utc, return_type=str)]
