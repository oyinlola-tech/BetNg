"""The wire shapes of the odds service.

These mirror `packages/contracts/src/odds` exactly. They are written out again
here rather than imported, because a TypeScript package must not become a
build dependency of a Python service. `docs/api/rpc.md` is the document both
sides answer to.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

MarketType = Literal["MATCH_RESULT", "OVER_UNDER", "BOTH_TEAMS_TO_SCORE"]
MarketStatus = Literal["OPEN", "SUSPENDED", "SETTLED"]


class Selection(BaseModel):
    """One priced outcome within a market."""

    model_config = ConfigDict(frozen=True)

    id: str
    marketId: str
    code: Annotated[str, Field(min_length=1, max_length=32)]
    label: Annotated[str, Field(min_length=1, max_length=64)]
    odds: Annotated[float, Field(gt=1, le=1000)]
    probability: Annotated[float, Field(ge=0, le=1)]


class Market(BaseModel):
    """A market and every outcome priced within it."""

    model_config = ConfigDict(frozen=True)

    id: str
    matchId: str
    type: MarketType
    status: MarketStatus
    selections: Annotated[list[Selection], Field(min_length=2)]
    updatedAt: str


class MatchOdds(BaseModel):
    """Every market currently priced for one match."""

    model_config = ConfigDict(frozen=True)

    matchId: str
    markets: list[Market]
    generatedAt: str


class OutcomeProbabilities(BaseModel):
    """The probabilities the odds service prices from.

    Supplied by the simulation service, which owns them. The odds service
    applies a margin; it never decides how likely an outcome is.
    """

    model_config = ConfigDict(frozen=True)

    matchId: str
    homeWin: Annotated[float, Field(ge=0, le=1)]
    draw: Annotated[float, Field(ge=0, le=1)]
    awayWin: Annotated[float, Field(ge=0, le=1)]


class CalculateOddsRequest(BaseModel):
    """The payload of the ``odds.calculateOdds`` procedure."""

    model_config = ConfigDict(frozen=True)

    matchId: str
    probabilities: OutcomeProbabilities


class GetMatchOddsRequest(BaseModel):
    """The payload of the ``odds.getMatchOdds`` procedure."""

    model_config = ConfigDict(frozen=True)

    matchId: str
