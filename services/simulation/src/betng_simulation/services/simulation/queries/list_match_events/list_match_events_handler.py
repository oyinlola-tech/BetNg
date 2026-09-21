"""List match events handler."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import MatchEventList, MatchEventView
from .....errors import MatchNotSimulatedError
from .....repositories import SimulationRepository
from .list_match_events_query import ListMatchEventsQuery


class ListMatchEventsHandler(QueryHandler[ListMatchEventsQuery, MatchEventList]):
    """Reads a match's whole timeline for internal callers."""

    message_type = SimulationQuery.LIST_MATCH_EVENTS

    def __init__(self, repository: SimulationRepository) -> None:
        """Store the collaborators."""
        self._repository = repository

    async def execute(self, message: ListMatchEventsQuery) -> MatchEventList:
        """Execute the message."""
        async with self._repository.transaction() as connection:
            run = await self._repository.get_latest_run(connection, message.match_id)

            if run is None:
                raise MatchNotSimulatedError

            events = await self._repository.list_events(connection, message.match_id)

        return MatchEventList(
            items=[
                MatchEventView.model_validate(
                    {
                        "id": event.id,
                        "match_id": event.match_id,
                        "sequence": event.sequence,
                        "minute": event.minute,
                        "type": event.type,
                        "side": event.side,
                        "player": event.player,
                        "secondary_player": event.secondary_player,
                        "score": {"home": event.score_home, "away": event.score_away},
                        "description": event.description,
                    }
                )
                for event in events
            ]
        )
