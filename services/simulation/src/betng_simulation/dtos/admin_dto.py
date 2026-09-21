"""The wire shapes of the admin routes.

``AdminSimulationRun`` mirrors ``adminSimulationRunSchema`` in
`packages/contracts/src/admin/operations.type.ts`.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, SerializerFunctionWrapHandler, model_serializer

from .base_dto import ContractModel, IsoTimestamp
from .configuration_dto import ModelParametersDto

AdminRunStatus = Literal["QUEUED", "READY", "RUNNING", "COMPLETED", "FAILED"]
SimulationAdminAction = Literal["RETRY", "CANCEL"]


class AdminRunScore(ContractModel):
    """A revealed score."""

    home: int
    away: int


class AdminSimulationRun(ContractModel):
    """Mirrors ``adminSimulationRunSchema``."""

    id: UUID
    match_id: UUID
    status: AdminRunStatus
    started_at: IsoTimestamp | None = None
    completed_at: IsoTimestamp | None = None
    events: int
    #: ``None`` until the match is ``COMPLETED``: no admin route reveals a
    #: score while a match is still being played out.
    score: AdminRunScore | None
    seed: str
    model_version: str
    configuration_version: int
    attempt: int
    match_label: str
    league_name: str
    error: str | None = None

    @model_serializer(mode="wrap")
    def _omit_absent_optionals(
        self, handler: SerializerFunctionWrapHandler
    ) -> dict[str, Any]:
        # The contract's optional fields are absent, not null. `score` is the
        # exception: its null is the statement that the score is withheld.
        data: dict[str, Any] = handler(self)

        return {
            key: value
            for key, value in data.items()
            if value is not None or key == "score"
        }


class AdminSimulationRunList(ContractModel):
    """List envelope."""

    items: list[AdminSimulationRun]


class SimulationActionRequest(ContractModel):
    """Body of the run action route."""

    action: SimulationAdminAction
    reason: Annotated[str, Field(min_length=3, max_length=500)]


class ModelConfigurationView(ContractModel):
    """One stored configuration version."""

    version: int
    model_version: str
    active: bool
    params: ModelParametersDto
    created_at: IsoTimestamp
    created_by: str
    reason: str


class ModelConfigurationUpdate(ModelParametersDto):
    """A partial set of parameters and why they are changing."""

    reason: Annotated[str, Field(min_length=3, max_length=500)]
