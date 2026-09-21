"""The wire shapes of the simulation RPC procedures and internal routes.

They mirror `packages/contracts/src/platform/lifecycle.type.ts`. They are
written out again here rather than imported, because a TypeScript package must
not become a build dependency of a Python service: the contract is the JSON in
`docs/architecture.md` §6, and each side implements it in its own language.
"""

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
    """The body of the internal run route. The match id is the path's."""

    home: SimulationTeamDto
    away: SimulationTeamDto


class RunMatchRequest(RunMatchBody):
    """Mirrors ``runMatchRequestSchema``: the match and its two teams, only."""

    match_id: UUID


class MatchScoreResult(ContractModel):
    """Score, winner and gap."""

    home_goals: Annotated[int, Field(ge=0)]
    away_goals: Annotated[int, Field(ge=0)]
    winner: WinnerDto
    winning_gap: Annotated[int, Field(ge=0)]


class RunMatchResponse(ContractModel):
    """Mirrors ``runMatchResponseSchema``."""

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
    """Payload of ``simulation.calculateProbabilities``."""

    home: TeamStrengthDto
    away: TeamStrengthDto


class ProbabilityMatrixResponse(ContractModel):
    """Mirrors ``probabilityMatrixSchema``."""

    home_xg: float
    away_xg: float
    max_goals: int
    score_matrix: list[list[float]]
    model_version: str
    configuration_version: int


class SimulationRunView(ContractModel):
    """A ``simulation_runs`` row."""

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
    """A ``match_results`` row."""

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
    """A run and its result, if any."""

    run: SimulationRunView
    result: MatchResultView | None


class EventScore(ContractModel):
    """Running score after an event."""

    home: int
    away: int


class MatchEventView(ContractModel):
    """Mirrors ``matchEventSchema``, plus the event's ``sequence``."""

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
    """List envelope."""

    items: list[MatchEventView]
