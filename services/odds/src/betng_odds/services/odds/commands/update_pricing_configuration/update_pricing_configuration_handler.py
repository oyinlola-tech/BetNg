"""Versioned pricing configuration changes.

A change inserts a new version; nothing is edited in place. It prices markets
published afterwards, so a market already on sale keeps the prices every
client has seen.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from betng_service_kit import CommandHandler

from .....constants import AuditAction, OddsCommand
from .....dtos import PricingConfigurationView
from .....interfaces import AuditRecorder, OddsRepository
from .....types import AuditEntry, ConfigurationRecord
from .....utils import to_configuration_view
from .update_pricing_configuration_command import UpdatePricingConfigurationCommand

_AUDIT_SEVERITY = "WARNING"


def _audit_view(record: ConfigurationRecord) -> dict[str, Any]:
    view = to_configuration_view(record)

    return {
        "version": view.version,
        "margins": dict(view.margins),
        "minOdds": view.min_odds,
        "maxOdds": view.max_odds,
    }


@dataclass(frozen=True)
class UpdatePricingConfigurationHandler(
    CommandHandler[UpdatePricingConfigurationCommand, PricingConfigurationView]
):
    """Store the next configuration version; fail if it cannot be audited."""

    repository: OddsRepository
    audit_recorder: AuditRecorder
    logger: logging.Logger

    message_type = OddsCommand.UPDATE_PRICING_CONFIGURATION

    async def execute(
        self, message: UpdatePricingConfigurationCommand
    ) -> PricingConfigurationView:
        """Insert and activate the new version inside one audited transaction."""

        async def audit(
            before: ConfigurationRecord, after: ConfigurationRecord
        ) -> None:
            await self.audit_recorder.record(
                AuditEntry(
                    actor_id=message.actor.id,
                    actor_role=message.actor.role,
                    action=AuditAction.CONFIGURATION_CHANGED,
                    entity_type="pricing_configuration",
                    entity_id=str(after.pricing.version),
                    before=_audit_view(before),
                    after=_audit_view(after),
                    reason=message.request.reason,
                    severity=_AUDIT_SEVERITY,
                    request_id=message.request_id,
                )
            )

        record = await self.repository.insert_configuration(
            dict(message.request.margins),
            message.request.min_odds,
            message.request.max_odds,
            message.actor.id,
            message.request.reason,
            audit,
        )

        self.logger.info(
            "Pricing configuration changed",
            extra={
                "requestId": message.request_id,
                "event": AuditAction.CONFIGURATION_CHANGED,
                "pricingVersion": record.pricing.version,
            },
        )

        return to_configuration_view(record)
