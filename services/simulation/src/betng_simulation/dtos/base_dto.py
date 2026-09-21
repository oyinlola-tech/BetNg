"""The base every wire shape is built on."""

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
