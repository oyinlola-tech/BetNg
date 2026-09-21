"""What the simulation service reads about a match it does not own."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

MATCH_COMPLETED = "COMPLETED"


@dataclass(frozen=True)
class MatchView:
    """What this service reads about a match it does not own."""

    status: str
    league_name: str

    @property
    def result_revealed(self) -> bool:
        """Whether the match's result may be shown through the gateway."""
        return self.status == MATCH_COMPLETED


class MatchReadModel(Protocol):
    """Cross-schema read of ``match``."""

    async def get_matches(self, match_ids: Sequence[str]) -> dict[str, MatchView]:
        """Return the known matches keyed by id. Unknown ids are absent."""
        ...
