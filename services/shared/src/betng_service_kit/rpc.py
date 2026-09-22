"""RPC over HTTP, in the ``@zudojs/rpc`` wire format.

    request  {"id", "procedure", "payload", "metadata", "timestamp"}
    response {"id", "success", "result"?, "error"? {"code","message"}}

``metadata.requestId`` carries the correlation identifier across the hop.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

from .errors import ServiceError
from .internal_auth import internal_headers, is_internal_request
from .resilience import BreakerSettings, CircuitBreaker, CircuitOpenError, breaker_for
from .tracing import outbound_trace_headers

RPC_PATH = "/rpc"

RPC_PROCEDURE_NOT_FOUND = "RPC_PROCEDURE_NOT_FOUND"
RPC_VALIDATION_ERROR = "RPC_VALIDATION_ERROR"
RPC_INVALID_REQUEST = "RPC_INVALID_REQUEST"
RPC_INTERNAL_ERROR = "RPC_INTERNAL_ERROR"
RPC_UNAVAILABLE = "RPC_UNAVAILABLE"
RPC_TIMEOUT = "RPC_TIMEOUT"
RPC_NOT_IMPLEMENTED = "RPC_NOT_IMPLEMENTED"
RPC_RATE_LIMITED = "RPC_RATE_LIMITED"
RPC_CIRCUIT_OPEN = "RPC_CIRCUIT_OPEN"

#: Never returned over the wire: internal exception text can name hosts,
#: paths, credentials or queries, and the caller is an untrusted peer.
INTERNAL_RPC_MESSAGE = "An internal error occurred."


_RPC_REQUEST_ID: ContextVar[str | None] = ContextVar("betng_rpc_request_id", default=None)


def get_rpc_request_id() -> str | None:
    return _RPC_REQUEST_ID.get()


class RpcRequestFrame(BaseModel):
    id: str
    procedure: str
    payload: Any = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: int = 0


class RpcErrorPayload(BaseModel):
    code: str
    message: str
    details: Any = None


class RpcResponseFrame(BaseModel):
    id: str
    success: bool
    result: Any = None
    error: RpcErrorPayload | None = None
    metadata: dict[str, Any] | None = None


class RpcError(Exception):
    def __init__(
        self, code: str, message: str, details: Any = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


class RpcNotImplementedError(RpcError):
    """Raised while a procedure's implementation has not been built.

    The procedure name and its payload shape are fixed now, so callers can be
    written against them. Refusing is the honest answer; returning a
    fabricated result would let a caller build on a number that means nothing.
    """

    def __init__(self, capability: str) -> None:
        super().__init__(
            RPC_NOT_IMPLEMENTED,
            f"{capability} is not implemented yet. See docs/api/rpc.md.",
        )


RpcHandler = Callable[[Any], Awaitable[Any]]


@dataclass(frozen=True)
class RpcProcedure:
    name: str
    handler: RpcHandler
    payload_model: type[BaseModel] | None = None


@dataclass
class RpcServer:
    procedures: dict[str, RpcProcedure] = field(default_factory=dict)

    def register(self, procedure: RpcProcedure) -> None:
        if procedure.name in self.procedures:
            raise ValueError(
                f"A procedure named {procedure.name!r} is already registered."
            )

        self.procedures[procedure.name] = procedure

    def size(self) -> int:
        return len(self.procedures)

    async def handle(self, frame: RpcRequestFrame) -> RpcResponseFrame:
        """Dispatch one RPC request.

        Every failure is mapped to a typed wire code. An unexpected exception
        is answered with a fixed message, never its text.
        """
        procedure = self.procedures.get(frame.procedure)

        if procedure is None:
            return _failure(
                frame,
                RPC_PROCEDURE_NOT_FOUND,
                f"No procedure named {frame.procedure!r}.",
            )

        payload: Any = frame.payload

        if procedure.payload_model is not None:
            try:
                payload = procedure.payload_model.model_validate(frame.payload)
            except ValidationError as error:
                return _failure(
                    frame,
                    RPC_VALIDATION_ERROR,
                    "The payload failed validation.",
                    [
                        {
                            "path": ".".join(str(p) for p in issue["loc"]),
                            "message": issue["msg"],
                        }
                        for issue in error.errors()
                    ],
                )

        request_id = frame.metadata.get("requestId") if frame.metadata else None
        _RPC_REQUEST_ID.set(request_id if isinstance(request_id, str) else None)

        try:
            result = await procedure.handler(payload)
        except RpcError as error:
            return _failure(frame, error.code, error.message, error.details)
        except ServiceError as error:
            # A domain refusal is a describable outcome, not a fault. Its code
            # and message are the caller's answer and must survive the wire;
            # flattening it into an internal error would tell the caller only
            # that something went wrong.
            return _failure(frame, error.code, error.message, error.details)
        except Exception:
            import logging

            logging.getLogger("rpc").exception(
                "RPC procedure raised",
                extra={"procedure": frame.procedure, "rpcId": frame.id},
            )
            return _failure(frame, RPC_INTERNAL_ERROR, INTERNAL_RPC_MESSAGE)

        return RpcResponseFrame(
            id=frame.id,
            success=True,
            result=(
                result.model_dump() if isinstance(result, BaseModel) else result
            ),
        )


def _failure(
    frame: RpcRequestFrame, code: str, message: str, details: Any = None
) -> RpcResponseFrame:
    return RpcResponseFrame(
        id=frame.id,
        success=False,
        error=RpcErrorPayload(code=code, message=message, details=details),
    )


def create_rpc_router(server: RpcServer) -> APIRouter:
    """Mount an :class:`RpcServer` at ``POST /rpc``.

    The endpoint serves on the same listener as the service's REST API: one
    process, one port, one thing to health-check. It sits outside ``/api/v1``
    because it is internal — the gateway does not forward to it.

    A failed *procedure* still answers 200 with the RPC envelope: the
    transport succeeded, the call did not. The only non-200 is a body that is
    not an RPC frame at all.
    """
    router = APIRouter(tags=["rpc"])

    @router.post(RPC_PATH, include_in_schema=False)
    async def handle_rpc(frame: RpcRequestFrame, request: Request) -> Any:
        # RPC is service-to-service only; an outsider learns nothing here.
        if not is_internal_request(request):
            return JSONResponse(
                status_code=404,
                content=_failure(
                    frame, RPC_PROCEDURE_NOT_FOUND, "Not found."
                ).model_dump(exclude_none=True),
            )

        response = await server.handle(frame)

        return response.model_dump(exclude_none=True)

    return router


class RpcClient:
    def __init__(
        self,
        base_url: str,
        peer: str,
        timeout_ms: int,
        *,
        breaker: CircuitBreaker | None = None,
        breaker_settings: BreakerSettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = base_url.rstrip("/") + RPC_PATH
        self._peer = peer
        self._timeout = timeout_ms / 1000
        self._breaker = breaker or breaker_for(peer, breaker_settings)
        self._transport = transport

    @property
    def breaker(self) -> CircuitBreaker:
        return self._breaker

    async def call(
        self, procedure: str, payload: Any, *, request_id: str | None = None
    ) -> Any:
        try:
            self._breaker.before_call()
        except CircuitOpenError as error:
            raise RpcError(
                RPC_CIRCUIT_OPEN,
                f"The {self._peer} service is failing; calls are paused.",
            ) from error

        try:
            http_response = await self._post(procedure, payload, request_id)
        except RpcError:
            self._breaker.record_failure()
            raise
        except BaseException:
            self._breaker.release_probe()
            raise

        if http_response.status_code == 429:
            self._breaker.release_probe()
            raise RpcError(
                RPC_RATE_LIMITED,
                f"The {self._peer} service is rate limiting this caller.",
                {"retryAfter": http_response.headers.get("retry-after")},
            )

        if http_response.status_code != 200:
            self._breaker.record_failure()
            raise RpcError(
                RPC_UNAVAILABLE,
                f"The {self._peer} service answered {RPC_PATH} with "
                f"{http_response.status_code}.",
            )

        self._breaker.record_success()
        body = RpcResponseFrame.model_validate(http_response.json())

        if not body.success:
            error_payload = body.error
            raise RpcError(
                error_payload.code if error_payload else RPC_INTERNAL_ERROR,
                error_payload.message if error_payload else INTERNAL_RPC_MESSAGE,
                error_payload.details if error_payload else None,
            )

        return body.result

    async def _post(
        self, procedure: str, payload: Any, request_id: str | None
    ) -> httpx.Response:
        frame = {
            "id": str(uuid.uuid4()),
            "procedure": procedure,
            "payload": (
                payload.model_dump()
                if isinstance(payload, BaseModel)
                else payload
            ),
            "metadata": {} if request_id is None else {"requestId": request_id},
            "timestamp": int(time.time() * 1000),
        }

        headers = {
            "content-type": "application/json",
            **internal_headers(),
            **outbound_trace_headers(),
        }
        if request_id is not None:
            headers["x-request-id"] = request_id

        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                return await client.post(self._url, json=frame, headers=headers)
        except httpx.TimeoutException as error:
            raise RpcError(
                RPC_TIMEOUT,
                f"The {self._peer} service did not answer within "
                f"{int(self._timeout * 1000)}ms.",
            ) from error
        except httpx.HTTPError as error:
            raise RpcError(
                RPC_UNAVAILABLE,
                f"The {self._peer} service could not be reached.",
            ) from error
