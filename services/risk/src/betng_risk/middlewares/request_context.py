"""Carries an RPC frame's ``metadata.requestId`` to the procedure."""

from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_.:-]{8,128}$")

_rpc_request_id: ContextVar[str | None] = ContextVar(
    "risk_rpc_request_id", default=None
)


def safe_request_id(candidate: Any) -> str | None:
    """Return the identifier when it is safe to store and log."""
    if isinstance(candidate, str) and _SAFE_REQUEST_ID.match(candidate):
        return candidate

    return None


def set_rpc_request_id(request_id: str) -> None:
    """Remember the identifier for the procedure about to run."""
    _rpc_request_id.set(request_id)


def current_rpc_request_id() -> str:
    """Return the identifier of the RPC call in progress."""
    return _rpc_request_id.get() or "unknown"
