from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import Field

from ..engine import SimulationTeam, TeamStrength
from .base_dto import ContractModel

Rating = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
Form = Annotated[float, Field(ge=-10, le=10, allow_inf_nan=False)]


class TeamStrengthDto(ContractModel):
    attack: Rating
    defence: Rating
    midfield: Rating
    goalkeeping: Rating
    pace: Rating
    finishing: Rating
    possession: Rating
    form: Form
    home_advantage: Rating

    def to_engine(self) -> TeamStrength:
        return TeamStrength(
            attack=self.attack,
            defence=self.defence,
            midfield=self.midfield,
            goalkeeping=self.goalkeeping,
            pace=self.pace,
            finishing=self.finishing,
            possession=self.possession,
            form=self.form,
            home_advantage=self.home_advantage,
        )


class SimulationTeamDto(ContractModel):
    team_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=120)]
    short_name: Annotated[str, Field(min_length=2, max_length=8)]
    strength: TeamStrengthDto

    def to_engine(self) -> SimulationTeam:
        return SimulationTeam(
            team_id=str(self.team_id),
            name=self.name,
            short_name=self.short_name,
            strength=self.strength.to_engine(),
        )
