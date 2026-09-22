from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx
from betng_service_kit import RpcClient, RpcError
from pydantic import ValidationError

from ..constants import ODDS_UPDATED_EVENT, PeerProcedure
from ..dtos import ProbabilityMatrix, TeamStrength
from ..errors import AuditUnavailableError, OddsUnavailableError
from ..interfaces import AuditRecorder, EventPublisher, ProbabilityModel
from ..types import AuditEntry


@dataclass(frozen=True)
class RpcProbabilityModel(ProbabilityModel):
    client: RpcClient
    health_url: str
    timeout_seconds: float
    logger: logging.Logger

    async def calculate(
        self,
        match_id: str,
        home: TeamStrength,
        away: TeamStrength,
        request_id: str | None,
    ) -> ProbabilityMatrix:
        # The match id seeds the model's pricing stream; it carries no bet data.
        payload = {
            "matchId": match_id,
            "home": home.model_dump(by_alias=True),
            "away": away.model_dump(by_alias=True),
        }

        try:
            result = await self.client.call(
                PeerProcedure.CALCULATE_PROBABILITIES, payload, request_id=request_id
            )
            return ProbabilityMatrix.model_validate(result)
        except RpcError as error:
            self.logger.warning(
                "Probability model call failed",
                extra={"requestId": request_id, "rpcCode": error.code},
            )
            raise OddsUnavailableError(
                "The probability model could not be reached, so no odds were published."
            ) from error
        except ValidationError as error:
            self.logger.error(
                "Probability model answered an unusable matrix",
                extra={"requestId": request_id},
            )
            raise OddsUnavailableError(
                "The probability model answered an unusable result, so no odds "
                "were published."
            ) from error

    async def ping(self) -> None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(self.health_url)
        except httpx.HTTPError as error:
            # The transport error names the peer's host; readiness does not.
            raise RuntimeError("unreachable") from error

        if response.status_code != 200:
            raise RuntimeError(f"health answered {response.status_code}")


@dataclass(frozen=True)
class RpcEventPublisher(EventPublisher):
    client: RpcClient

    async def publish_odds_updated(
        self, match_id: str, description: str, request_id: str | None
    ) -> None:
        await self.client.call(
            PeerProcedure.PUBLISH_EVENT,
            {
                "matchId": match_id,
                "type": ODDS_UPDATED_EVENT,
                "minute": 0,
                "score": {"home": 0, "away": 0},
                "description": description,
            },
            request_id=request_id,
        )


@dataclass(frozen=True)
class RpcAuditRecorder(AuditRecorder):
    """``identity.recordAudit``."""

    client: RpcClient
    logger: logging.Logger

    async def record(self, entry: AuditEntry) -> None:
        """Write one audit entry, or raise if it cannot be written."""
        try:
            await self.client.call(
                PeerProcedure.RECORD_AUDIT,
                {
                    "actorId": entry.actor_id,
                    "actorRole": entry.actor_role,
                    "action": entry.action,
                    "entityType": entry.entity_type,
                    "entityId": entry.entity_id,
                    "before": entry.before,
                    "after": entry.after,
                    "reason": entry.reason,
                    "severity": entry.severity,
                    "requestId": entry.request_id,
                },
                request_id=entry.request_id,
            )
        except RpcError as error:
            self.logger.error(
                "Audit entry could not be written",
                extra={
                    "requestId": entry.request_id,
                    "action": entry.action,
                    "rpcCode": error.code,
                },
            )
            raise AuditUnavailableError from error
