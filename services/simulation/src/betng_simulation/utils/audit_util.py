"""Best-effort audit delivery for lifecycle events."""

from __future__ import annotations

import asyncio
import logging

from ..interfaces import AuditEntry, AuditRecorder


class BackgroundAuditor:
    """Delivers lifecycle audit entries without blocking or failing the caller."""

    def __init__(self, recorder: AuditRecorder, logger: logging.Logger) -> None:
        """Store the collaborators."""
        self._recorder = recorder
        self._logger = logger
        # Strong references: the loop alone would let a pending task be collected.
        self._pending: set[asyncio.Task[None]] = set()

    def submit(self, *entries: AuditEntry) -> None:
        """Deliver ``entries`` in order, without blocking the caller."""
        task = asyncio.create_task(self._deliver(entries))
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def drain(self) -> None:
        """Wait for pending deliveries."""
        if self._pending:
            await asyncio.gather(*self._pending, return_exceptions=True)

    async def _deliver(self, entries: tuple[AuditEntry, ...]) -> None:
        for entry in entries:
            try:
                await self._recorder.record(entry)
            except Exception as error:
                self._logger.warning(
                    "Audit entry could not be written",
                    extra={
                        "event": entry.action,
                        "entityId": entry.entity_id,
                        "requestId": entry.request_id,
                        "errorType": type(error).__name__,
                    },
                )
