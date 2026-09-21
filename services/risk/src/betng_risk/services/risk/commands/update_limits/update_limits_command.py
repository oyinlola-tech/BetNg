"""The limits update command."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import RiskCommand
from .....dtos import RiskLimits, UpdateRiskLimitsRequest


@dataclass(frozen=True)
class UpdateLimitsCommand(Command[RiskLimits]):
    """Puts a new limits version in force, on behalf of an admin."""

    request: UpdateRiskLimitsRequest
    actor_id: str
    actor_role: str
    request_id: str

    type: str = RiskCommand.UPDATE_LIMITS
