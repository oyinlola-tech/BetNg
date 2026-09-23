from __future__ import annotations

from typing import Final
from uuid import UUID

from ..dtos import LineupPositionDto, SquadPlayerView, TeamSquadView
from ..engine import (
    EXPANDED_NAME_POOL,
    STARTING_FORMATION,
    Player,
    Position,
    squad_for,
)

POSITION_CODES: Final[dict[Position, LineupPositionDto]] = {
    "GOALKEEPER": "GK",
    "DEFENDER": "DF",
    "MIDFIELDER": "MF",
    "FORWARD": "FW",
}

FORMATION: Final = "-".join(
    str(count) for position, count in STARTING_FORMATION if position != "GOALKEEPER"
)


def _views(
    team_id: str, players: tuple[Player, ...], first_shirt: int
) -> list[SquadPlayerView]:
    return [
        SquadPlayerView(
            id=f"{team_id}:{shirt}",
            name=player.name,
            shirt=shirt,
            position=POSITION_CODES[player.position],
        )
        for shirt, player in enumerate(players, start=first_shirt)
    ]


def to_team_squad(
    team_id: UUID,
    name_pool: int = EXPANDED_NAME_POOL,
    country: str | None = None,
) -> TeamSquadView:
    # The timeline keys its squads by `str(team_id)` and the same country, so both
    # name the same people; passing one and not the other would split them.
    key = str(team_id)
    squad = squad_for(key, name_pool, country)

    return TeamSquadView(
        team_id=team_id,
        formation=FORMATION,
        starting=_views(key, squad.starters, 1),
        substitutes=_views(key, squad.bench, len(squad.starters) + 1),
    )
