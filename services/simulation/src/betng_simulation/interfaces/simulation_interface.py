from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from ..engine import ModelConfiguration, SimulationOutput, SimulationTeam


@dataclass(frozen=True)
class StoredConfiguration:
    configuration: ModelConfiguration
    active: bool
    created_at: datetime
    created_by: str
    reason: str


@dataclass(frozen=True)
class RunRecord:
    id: str
    match_id: str
    status: str
    model_version: str
    configuration_version: int
    seed: str
    attempt: int
    started_at: datetime
    completed_at: datetime | None
    failure_reason: str | None
    home_team_name: str
    away_team_name: str
    retry_requested_at: datetime | None


@dataclass(frozen=True)
class ResultRecord:
    match_id: str
    simulation_id: str
    home_goals: int
    away_goals: int
    winner: str
    winning_gap: int
    home_xg: float
    away_xg: float
    seed: str
    model_version: str
    configuration_version: int
    stats: dict[str, Any]
    created_at: datetime


@dataclass(frozen=True)
class EventRecord:
    id: str
    match_id: str
    sequence: int
    minute: int
    type: str
    side: str | None
    player: str | None
    secondary_player: str | None
    score_home: int
    score_away: int
    description: str


@dataclass(frozen=True)
class AdminRunRecord:
    run: RunRecord
    #: ``QUEUED`` when a failed run is waiting for the retry an admin asked for.
    admin_status: str
    event_count: int
    home_goals: int | None
    away_goals: int | None


class Simulate(Protocol):
    """The engine's signature: no bet data; the seed key is its only non-match input."""

    def __call__(
        self,
        match_id: str,
        home: SimulationTeam,
        away: SimulationTeam,
        configuration: ModelConfiguration,
        seed_secret: str | None = None,
    ) -> SimulationOutput:
        """Simulate one match."""
        ...
