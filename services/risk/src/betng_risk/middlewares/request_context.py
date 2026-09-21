from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_.:-]{8,128}$")

_rpc_request_id: ContextVar[str | None] = ContextVar(
    "risk_rpc_request_id", default=None
)


def safe_request_id(candidate: Any) -> str | None:
    if isinstance(candidate, str) and _SAFE_REQUEST_ID.match(candidate):
        return candidate

    return None


def set_rpc_request_id(request_id: str) -> None:
    _rpc_request_id.set(request_id)


def current_rpc_request_id() -> str:
    return _rpc_request_id.get() or "unknown"
