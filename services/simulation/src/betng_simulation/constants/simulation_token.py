"""Container tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import AuditRecorder, MatchReadModel, Simulate
from ..repositories import SimulationRepository
from ..utils import BackgroundAuditor

SIMULATION_REPOSITORY_TOKEN: Token[SimulationRepository] = Token(
    "simulation.repository"
)
MATCH_READ_MODEL_TOKEN: Token[MatchReadModel] = Token("simulation.matchReadModel")
AUDIT_RECORDER_TOKEN: Token[AuditRecorder] = Token("simulation.auditRecorder")
BACKGROUND_AUDITOR_TOKEN: Token[BackgroundAuditor] = Token(
    "simulation.backgroundAuditor"
)
SIMULATE_TOKEN: Token[Simulate] = Token("simulation.simulate")
LOGGER_TOKEN: Token[logging.Logger] = Token("simulation.logger")
