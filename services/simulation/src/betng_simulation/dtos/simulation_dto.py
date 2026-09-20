"""The wire shapes of the simulation service.

These mirror `packages/contracts/src/simulation` exactly. They are written out
again here rather than imported, because a TypeScript package must not become
a build dependency of a Python service — the contract is the JSON described in
`docs/api.md`, and each side implements it in its own language.

Any change here has to be made in `@betng/contracts` too. `docs/api.md` is the
document both sides answer to.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

MatchEventType = Literal[
    "KICK_OFF",
    "GOAL",
    "YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "HALF_TIME",
    "FULL_TIME",
]

MatchSide = Literal["HOME", "AWAY"]


class SimulationTeam(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: Annotated[str, Field(description="The team's UUID.")]
    name: Annotated[str, Field(min_length=1, max_length=120)]
    strength: Annotated[float, Field(ge=0, le=100)]


class SimulationRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    matchId: Annotated[str, Field(description="The match's UUID.")]
    homeTeam: SimulationTeam
    awayTeam: SimulationTeam
    seed: Annotated[
        int | None,
        Field(
            default=None,
            description=(
                "Optional seed for a reproducible run. Supplying one makes a "
                "simulation repeatable for testing; omitting it draws fresh "
                "randomness."
            ),
        ),
    ] = None


class MatchScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    home: Annotated[int, Field(ge=0)]
    away: Annotated[int, Field(ge=0)]


class SimulatedEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    type: MatchEventType
    minute: Annotated[int, Field(ge=0, le=120)]
    side: MatchSide | None = None
    description: Annotated[str, Field(max_length=240)]


class SimulationResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    matchId: str
    score: MatchScore
    events: list[SimulatedEvent]
    seed: Annotated[int, Field(description="The seed used, so a run replays.")]
    completedAt: str


class ProbabilityRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    matchId: str
    homeTeam: SimulationTeam
    awayTeam: SimulationTeam


class OutcomeProbabilities(BaseModel):
    """The response of ``POST /api/v1/probabilities``.

    The three outcome probabilities sum to 1. The odds service turns these
    into prices; it does not compute them itself.
    """

    model_config = ConfigDict(frozen=True)

    matchId: str
    homeWin: Annotated[float, Field(ge=0, le=1)]
    draw: Annotated[float, Field(ge=0, le=1)]
    awayWin: Annotated[float, Field(ge=0, le=1)]
