"""Container tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import AuditRecorder, RiskRepository

RISK_REPOSITORY_TOKEN: Token[RiskRepository] = Token("risk.repository")

AUDIT_RECORDER_TOKEN: Token[AuditRecorder] = Token("risk.auditRecorder")

LOGGER_TOKEN: Token[logging.Logger] = Token("risk.logger")
