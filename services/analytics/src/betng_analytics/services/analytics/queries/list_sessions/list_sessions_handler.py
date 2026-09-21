from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import SessionAnalysis, SessionAnalysisList
from .....interfaces import AnalyticsReader
from .....types import Row, SessionKind, Window
from .....utils import now, operator_result, rate, to_iso
from ...session_ids import (
    custom_session_id,
    day_session_id,
    hour_session_id,
    round_session_id,
)
from .list_sessions_query import ListSessionsQuery


def _identity(kind: SessionKind, row: Row, window: Window) -> tuple[str, str]:
    """Return the session's id and label."""
    if kind == "HOUR":
        return (
            hour_session_id(row["day_code"], row["hour"]),
            f"{row['day_label']} {row['hour']:02d}:00",
        )

    if kind == "DAY":
        return day_session_id(row["day_code"]), row["day_label"]

    if kind == "CUSTOM":
        return custom_session_id(row["starts_at"], row["ends_at"]), "Custom window"

    unit = "Matchday" if kind == "MATCHDAY" else "Round"

    return (
        round_session_id(kind, row["league_code"], row["season"], row["matchday"]),
        f"{row['league_name']} - Season {row['season']} - "
        f"{unit} {row['matchday']}",
    )


class ListSessionsHandler(QueryHandler[ListSessionsQuery, SessionAnalysisList]):
    message_type = AnalyticsQueryType.LIST_SESSIONS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: ListSessionsQuery) -> SessionAnalysisList:
        window = message.scope.window
        rows = await self._reader.sessions(
            message.kind, message.scope, message.limit
        )

        if message.kind == "CUSTOM":
            generated_at = now()
            rows = [
                {
                    **row,
                    "starts_at": window.start
                    or row["first_placed_at"]
                    or generated_at,
                    "ends_at": window.end or row["last_placed_at"] or generated_at,
                }
                for row in rows
            ]

        items: list[SessionAnalysis] = []

        for row in rows:
            session_id, label = _identity(message.kind, row, window)
            result = operator_result(row["settled_stake"], row["payout"])

            items.append(
                SessionAnalysis(
                    session_id=session_id,
                    kind=message.kind,
                    label=label,
                    starts_at=to_iso(row["starts_at"]),
                    ends_at=to_iso(row["ends_at"]),
                    bets=row["bets"],
                    stake=row["stake"],
                    payout=row["payout"],
                    operator_result=result,
                    operator_result_rate=rate(result, row["settled_stake"]),
                    customers=row["customers"],
                    shops=row["shops"],
                    cashiers=row["cashiers"],
                    markets=row["markets"],
                    matches=row["matches"],
                )
            )

        return SessionAnalysisList(items=items)
