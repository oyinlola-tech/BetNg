from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, SerializerFunctionWrapHandler, model_serializer

from .base_dto import ContractModel, IsoTimestamp
from .configuration_dto import ModelParametersDto

AdminRunStatus = Literal["QUEUED", "READY", "RUNNING", "COMPLETED", "FAILED"]
SimulationAdminAction = Literal["RETRY", "CANCEL"]
WITHHELD_FIELDS = frozenset({"score", "seed"})


class AdminRunScore(ContractModel):
    home: int
    away: int


class AdminSimulationRun(ContractModel):
    id: UUID
    match_id: UUID
    status: AdminRunStatus
    started_at: IsoTimestamp | None = None
    completed_at: IsoTimestamp | None = None
    events: int
    #: ``None`` until the match is ``COMPLETED`` (result secrecy).
    score: AdminRunScore | None
    #: Withheld like ``score``: a seed plus the source code is a result.
    seed: str | None
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
        # Contract optionals are absent, not null; null `score`/`seed` mean withheld.
        data: dict[str, Any] = handler(self)

        return {
            key: value
            for key, value in data.items()
            if value is not None or key in WITHHELD_FIELDS
        }


class AdminSimulationRunList(ContractModel):
    items: list[AdminSimulationRun]


class SimulationActionRequest(ContractModel):
    action: SimulationAdminAction
    reason: Annotated[str, Field(min_length=3, max_length=500)]


class ModelConfigurationView(ContractModel):
    version: int
    model_version: str
    active: bool
    params: ModelParametersDto
    created_at: IsoTimestamp
    created_by: str
    reason: str


class ModelConfigurationUpdate(ModelParametersDto):
    reason: Annotated[str, Field(min_length=3, max_length=500)]
