from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from .base_dto import ContractModel

LineupPositionDto = Literal["GK", "DF", "MF", "FW"]


class SquadTeamRef(ContractModel):
    team_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=120)]


class GetSquadsRequest(ContractModel):
    home: SquadTeamRef
    away: SquadTeamRef


class SquadPlayerView(ContractModel):
    id: Annotated[str, Field(min_length=1, max_length=64)]
    name: Annotated[str, Field(min_length=1, max_length=120)]
    shirt: Annotated[int, Field(ge=1, le=99)]
    position: LineupPositionDto


class TeamSquadView(ContractModel):
    team_id: UUID
    formation: Annotated[str, Field(max_length=12)]
    starting: list[SquadPlayerView]
    substitutes: list[SquadPlayerView]


class SquadsResponse(ContractModel):
    home: TeamSquadView
    away: TeamSquadView
