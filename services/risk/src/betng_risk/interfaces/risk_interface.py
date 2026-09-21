from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from datetime import datetime
from typing import Any, Protocol

from ..engine import SelectionState
from ..types import (
    AuditEntry,
    BookRows,
    BookTotals,
    DecisionRecord,
    DecisionTally,
    LimitsDraft,
    LimitsRecord,
    MarketRow,
    MarketTypeRow,
    MatchRow,
    SelectionRow,
)

#: Runs inside the limits transaction, after the new version is written and
#: before it commits; raising rolls the version back.
BeforeLimitsCommit = Callable[[LimitsRecord, LimitsRecord], Awaitable[None]]


class RiskRepository(Protocol):
    async def load_limits(self) -> LimitsRecord: ...

    async def replace_limits(
        self,
        draft: Callable[[LimitsRecord], LimitsDraft],
        *,
        created_by: str,
        reason: str,
        before_commit: BeforeLimitsCommit,
    ) -> LimitsRecord: ...

    async def load_selection_states(
        self, selection_ids: Sequence[str]
    ) -> dict[str, SelectionState]: ...

    async def load_book(self, match_ids: Sequence[str] | None) -> BookRows: ...

    async def load_book_totals(self) -> BookTotals: ...

    async def load_market_type_stakes(self) -> list[MarketTypeRow]: ...

    async def load_matches(self, match_ids: Sequence[str]) -> list[MatchRow]: ...

    async def load_dashboard_match_ids(self) -> list[str]: ...

    async def load_markets(self, market_ids: Sequence[str]) -> list[MarketRow]: ...

    async def load_selections(
        self, market_ids: Sequence[str]
    ) -> list[SelectionRow]: ...

    async def load_snapshots(self, match_ids: Sequence[str]) -> dict[str, Any]:
        """Return the frozen exposure snapshot of each frozen match."""
        ...

    async def insert_decision(self, record: DecisionRecord) -> None: ...

    async def insert_freeze(
        self, match_id: str, snapshot: dict[str, Any]
    ) -> datetime: ...

    async def count_decisions(self, since: datetime) -> DecisionTally: ...


class AuditRecorder(Protocol):
    """Writes an audit entry through the identity service."""

    async def record(self, entry: AuditEntry) -> None: ...
