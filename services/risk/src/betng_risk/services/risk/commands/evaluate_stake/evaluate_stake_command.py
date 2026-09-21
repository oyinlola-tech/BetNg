"""The stake evaluation command."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import RiskCommand
from .....dtos import RiskDecision, RiskEvaluateRequest


@dataclass(frozen=True)
class EvaluateStakeCommand(Command[RiskDecision]):
    """Asks for a stake decision; a command because each one is stored."""

    request: RiskEvaluateRequest
    request_id: str

    type: str = RiskCommand.EVALUATE_STAKE
