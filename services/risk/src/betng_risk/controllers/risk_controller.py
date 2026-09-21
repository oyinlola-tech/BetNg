"""Risk HTTP handlers: they translate a request into a bus message."""

from __future__ import annotations

from uuid import UUID

from betng_service_kit import Actor, CommandBus, QueryBus

from ..constants import ADMIN_ACTOR_KIND
from ..dtos import (
    MatchExposure,
    MatchExposureList,
    RiskDecision,
    RiskEvaluateRequest,
    RiskLimits,
    RiskOverview,
    UpdateRiskLimitsRequest,
)
from ..services.risk.commands import EvaluateStakeCommand, UpdateLimitsCommand
from ..services.risk.queries import (
    GetLimitsQuery,
    GetMatchExposureQuery,
    GetOverviewQuery,
    ListExposureQuery,
)


class RiskController:
    """The REST face of the risk buses."""

    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        """Bind the controller to the buses."""
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def evaluate(
        self, request: RiskEvaluateRequest, request_id: str
    ) -> RiskDecision:
        """Decide a slip."""
        return await self._command_bus.execute(
            EvaluateStakeCommand(request, request_id)
        )

    async def match_exposure(self, match_id: UUID) -> MatchExposure:
        """Read one match's exposure."""
        return await self._query_bus.execute(GetMatchExposureQuery(str(match_id)))

    async def overview(self) -> RiskOverview:
        """Read the platform-wide overview."""
        return await self._query_bus.execute(GetOverviewQuery())

    async def exposure(self) -> MatchExposureList:
        """Read the exposure dashboard."""
        return await self._query_bus.execute(ListExposureQuery())

    async def limits(self) -> RiskLimits:
        """Read the limits in force."""
        return await self._query_bus.execute(GetLimitsQuery())

    async def update_limits(
        self, request: UpdateRiskLimitsRequest, actor: Actor, request_id: str
    ) -> RiskLimits:
        """Put a new limits version in force as the calling admin."""
        return await self._command_bus.execute(
            UpdateLimitsCommand(
                request=request,
                actor_id=actor.id,
                actor_role=actor.role or ADMIN_ACTOR_KIND,
                request_id=request_id,
            )
        )
