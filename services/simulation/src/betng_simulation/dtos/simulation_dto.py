from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field

from .base_dto import ContractModel, IsoTimestamp
from .team_dto import SimulationTeamDto, TeamStrengthDto

WinnerDto = Literal["HOME", "AWAY", "DRAW"]
RunStatusDto = Literal["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]
MatchEventTypeDto = Literal[
    "KICK_OFF",
    "GOAL",
    "YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "CORNER",
    "HALF_TIME",
    "SECOND_HALF",
    "FULL_TIME",
]
MatchSideDto = Literal["HOME", "AWAY"]


class RunMatchBody(ContractModel):
    home: SimulationTeamDto
    away: SimulationTeamDto


class RunMatchRequest(RunMatchBody):
    match_id: UUID


class MatchScoreResult(ContractModel):
    home_goals: Annotated[int, Field(ge=0)]
    away_goals: Annotated[int, Field(ge=0)]
    winner: WinnerDto
    winning_gap: Annotated[int, Field(ge=0)]


class RunMatchResponse(ContractModel):
    simulation_id: UUID
    match_id: UUID
    status: Literal["COMPLETED", "FAILED"]
    duplicate: bool
    model_version: str
    configuration_version: int
    seed: str
    result: MatchScoreResult
    event_count: Annotated[int, Field(ge=0)]


class CalculateProbabilitiesRequest(ContractModel):
    home: TeamStrengthDto
    away: TeamStrengthDto


class ProbabilityMatrixResponse(ContractModel):
    home_xg: float
    away_xg: float
    max_goals: int
    score_matrix: list[list[float]]
    model_version: str
    configuration_version: int


class SimulationRunView(ContractModel):
    id: UUID
    match_id: UUID
    status: RunStatusDto
    model_version: str
    configuration_version: int
    seed: str
    attempt: int
    started_at: IsoTimestamp
    completed_at: IsoTimestamp | None = None
    failure_reason: str | None = None


class MatchResultView(ContractModel):
    match_id: UUID
    simulation_id: UUID
    home_goals: int
    away_goals: int
    winner: WinnerDto
    winning_gap: int
    home_xg: float
    away_xg: float
    seed: str
    model_version: str
    configuration_version: int
    stats: dict[str, Any]
    created_at: IsoTimestamp


class MatchRunDetail(ContractModel):
    run: SimulationRunView
    result: MatchResultView | None


class EventScore(ContractModel):
    home: int
    away: int


class MatchEventView(ContractModel):
    id: UUID
    match_id: UUID
    sequence: int
    minute: int
    type: MatchEventTypeDto
    side: MatchSideDto | None = None
    player: str | None = None
    secondary_player: str | None = None
    score: EventScore
    description: str


class MatchEventList(ContractModel):
    items: list[MatchEventView]
