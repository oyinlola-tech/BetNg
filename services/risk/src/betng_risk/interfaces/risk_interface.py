"""The contracts the risk handlers are written against.

What is absent matters as much as what is present: nothing here reads a match
result, a score or an event, and nothing writes outside the ``risk`` schema.
Risk answers with a stake decision and nothing else.
"""

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
    """Reads of the shared database and writes to the ``risk`` schema."""

    async def load_limits(self) -> LimitsRecord:
        """Return the limits version in force."""
        ...

    async def replace_limits(
        self,
        draft: Callable[[LimitsRecord], LimitsDraft],
        *,
        created_by: str,
        reason: str,
        before_commit: BeforeLimitsCommit,
    ) -> LimitsRecord:
        """Insert the next limits version and make it the active one."""
        ...

    async def load_selection_states(
        self, selection_ids: Sequence[str]
    ) -> dict[str, SelectionState]:
        """Return market and match state for each selection that exists."""
        ...

    async def load_book(self, match_ids: Sequence[str] | None) -> BookRows:
        """Return the pending book for the matches, or for every match."""
        ...

    async def load_book_totals(self) -> BookTotals:
        """Return the platform-wide pending totals."""
        ...

    async def load_market_type_stakes(self) -> list[MarketTypeRow]:
        """Return pending stake grouped by market type."""
        ...

    async def load_matches(self, match_ids: Sequence[str]) -> list[MatchRow]:
        """Return the matches that exist, ordered by kick-off."""
        ...

    async def load_dashboard_match_ids(self) -> list[str]:
        """Return open matches and closed, unsettled matches with pending bets."""
        ...

    async def load_markets(self, market_ids: Sequence[str]) -> list[MarketRow]:
        """Return the markets that exist."""
        ...

    async def load_selections(self, market_ids: Sequence[str]) -> list[SelectionRow]:
        """Return every selection of the markets, in display order."""
        ...

    async def load_snapshots(self, match_ids: Sequence[str]) -> dict[str, Any]:
        """Return the frozen exposure snapshot of each frozen match."""
        ...

    async def insert_decision(self, record: DecisionRecord) -> None:
        """Store one evaluation."""
        ...

    async def insert_freeze(self, match_id: str, snapshot: dict[str, Any]) -> datetime:
        """Store the snapshot unless one exists; return the winning instant."""
        ...

    async def count_decisions(self, since: datetime) -> DecisionTally:
        """Count stored decisions by kind since an instant."""
        ...


class AuditRecorder(Protocol):
    """Writes an audit entry through the identity service."""

    async def record(self, entry: AuditEntry) -> None:
        """Write the entry or raise."""
        ...
