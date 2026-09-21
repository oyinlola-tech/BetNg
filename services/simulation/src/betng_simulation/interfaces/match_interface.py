from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

MATCH_COMPLETED = "COMPLETED"


@dataclass(frozen=True)
class MatchView:
    status: str
    league_name: str

    @property
    def result_revealed(self) -> bool:
        return self.status == MATCH_COMPLETED


class MatchReadModel(Protocol):
    async def get_matches(self, match_ids: Sequence[str]) -> dict[str, MatchView]: ...
