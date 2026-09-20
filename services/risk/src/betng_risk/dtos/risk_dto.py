"""The wire shapes of the risk service.

These mirror `packages/contracts/src/risk` exactly. They are written out again
here rather than imported, because a TypeScript package must not become a
build dependency of a Python service. `docs/api/rpc.md` is the document both
sides answer to.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

RiskAction = Literal["ACCEPT", "REVIEW", "SUSPEND_MARKET"]


class SelectionExposure(BaseModel):
    model_config = ConfigDict(frozen=True)

    selectionId: str
    stake: Annotated[int, Field(ge=0)]
    liability: Annotated[int, Field(ge=0)]


class ExposureRequest(BaseModel):
    """The payload of ``risk.calculateExposure``.

    Note what it carries: aggregate stake per selection, never a bettor
    identity. The risk service cannot tell who backed what, which is what
    keeps it incapable of targeting anyone even in principle.
    """

    model_config = ConfigDict(frozen=True)

    matchId: str
    marketId: str
    selections: Annotated[list[SelectionExposure], Field(min_length=1)]
    currency: str = "NGN"


class ExposureReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    matchId: str
    marketId: str
    worstCaseLiability: Annotated[int, Field(ge=0)]
    worstCaseSelectionId: str
    totalStake: Annotated[int, Field(ge=0)]
    currency: str
    action: RiskAction
    evaluatedAt: str
