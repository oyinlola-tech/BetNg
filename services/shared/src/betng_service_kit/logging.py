"""Structured logging.

Every log line is one JSON object carrying the timestamp, level, service name
and message, so a collector parses the Python services exactly as it parses
the TypeScript ones. A request-scoped line additionally carries ``requestId``,
which is how one request is followed across the platform.
"""

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
    """Parse ``LOG_LEVEL``.

    An unrecognised level is a configuration mistake, not something to paper
    over with a default: silently logging at ``info`` when someone asked for
    ``debug`` wastes a debugging session.

    Args:
        name: The configured level name.

    Returns:
        The matching :mod:`logging` level.

    Raises:
        ValueError: When the name is not a level.
    """
    level = _LEVELS.get(name.strip().lower())

    if level is None:
        raise ValueError(
            "LOG_LEVEL must be one of fatal, error, warn, info, debug or "
            f"trace, got {name!r}."
        )

    return level


class JsonFormatter(logging.Formatter):
    """Renders a log record as one JSON object."""

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

    Args:
        service: The service name stamped on every line.
        version: The service version.
        environment: The environment name.
        level: The configured ``LOG_LEVEL``.

    Returns:
        The logger the service should use.
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

    return logging.getLogger(service)
