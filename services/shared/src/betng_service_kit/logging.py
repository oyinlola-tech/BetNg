from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

#: Attributes ``logging`` puts on every record, which must not be repeated
#: inside the JSON payload.
_RESERVED = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "module", "msecs",
        "message", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "taskName", "thread", "threadName",
    }
)

_LEVELS = {
    "fatal": logging.CRITICAL,
    "critical": logging.CRITICAL,
    "error": logging.ERROR,
    "warn": logging.WARNING,
    "warning": logging.WARNING,
    "info": logging.INFO,
    "debug": logging.DEBUG,
    "trace": logging.DEBUG,
}


def parse_log_level(name: str) -> int:
    level = _LEVELS.get(name.strip().lower())

    if level is None:
        raise ValueError(
            "LOG_LEVEL must be one of fatal, error, warn, info, debug or "
            f"trace, got {name!r}."
        )

    return level


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str, version: str, environment: str) -> None:
        super().__init__()
        self._base = {
            "service": service,
            "version": version,
            "environment": environment,
        }

    def format(self, record: logging.LogRecord) -> str:
        metadata: dict[str, Any] = dict(self._base)
        metadata.update(
            {
                key: value
                for key, value in record.__dict__.items()
                if key not in _RESERVED and not key.startswith("_")
            }
        )

        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelno,
            "levelName": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
            "metadata": metadata,
        }

        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(
    service: str, version: str, environment: str, level: str
) -> logging.Logger:
    """Install the JSON formatter on stdout and return the service logger.

    Replaces any handler already on the root logger, because uvicorn installs
    its own and two formatters on one stream produce interleaved output in two
    different shapes.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service, version, environment))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(parse_log_level(level))

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    # httpx narrates every outbound call at info. That is the HTTP client's
    # business, not the service's, and it doubles the log volume of an RPC
    # hop that the access log already records at both ends.
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)

    return logging.getLogger(service)
