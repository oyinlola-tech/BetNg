from __future__ import annotations

import logging

from betng_service_kit import RpcClient, RpcError

from ..interfaces import SignalPublisher

PUBLISH_SIGNAL_PROCEDURE = "event.publishSignal"


class EventSignalPublisher(SignalPublisher):
    def __init__(self, client: RpcClient, logger: logging.Logger) -> None:
        self._client = client
        self._logger = logger

    async def publish(self, channel: str, signal: str, request_id: str) -> bool:
        try:
            await self._client.call(
                PUBLISH_SIGNAL_PROCEDURE,
                {"channel": channel, "type": signal},
                request_id=request_id,
            )
        except (RpcError, ValueError) as error:
            self._logger.warning(
                "Realtime signal was not published",
                extra={
                    "requestId": request_id,
                    "event": "signal_not_published",
                    "signal": signal,
                    "error": getattr(error, "code", type(error).__name__),
                },
            )
            return False

        return True
