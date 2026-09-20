"""betng_service_kit.

The bootstrap every BetNG Python service is built from.

It exists so the three Python services share one implementation of the things
that must not drift between them — configuration loading, log shape, request
correlation, the error envelope and health semantics — rather than three
copies that slowly diverge, and so those things match what the TypeScript
services do.

Domain logic belongs in the services, never here.
"""

from .app import create_service_app
from .config import DEFAULT_PORTS, ServiceSettings, load_settings
from .container import Container, RegistrationNotFoundError, Token
from .cqrs import (
    Command,
    CommandBus,
    CommandHandler,
    DuplicateHandlerError,
    Handler,
    HandlerNotFoundError,
    Message,
    Query,
    QueryBus,
    QueryHandler,
)
from .errors import (
    CONFLICT,
    INTERNAL_ERROR,
    METHOD_NOT_ALLOWED,
    NOT_FOUND,
    NOT_IMPLEMENTED,
    SERVICE_UNAVAILABLE,
    ServiceError,
    UPSTREAM_UNAVAILABLE,
    VALIDATION_FAILED,
    build_error_body,
)
from .health import DependencyProbe, create_health_router
from .logging import configure_logging, parse_log_level
from .rpc import (
    RPC_INTERNAL_ERROR,
    RPC_NOT_IMPLEMENTED,
    RPC_PATH,
    RPC_PROCEDURE_NOT_FOUND,
    RPC_TIMEOUT,
    RPC_UNAVAILABLE,
    RPC_VALIDATION_ERROR,
    RpcClient,
    RpcError,
    RpcNotImplementedError,
    RpcProcedure,
    RpcRequestFrame,
    RpcResponseFrame,
    RpcServer,
    create_rpc_router,
)
from .middleware import REQUEST_ID_HEADER, get_request_id

__all__ = [
    "CONFLICT",
    "Command",
    "CommandBus",
    "CommandHandler",
    "Container",
    "DuplicateHandlerError",
    "Handler",
    "HandlerNotFoundError",
    "Message",
    "NOT_IMPLEMENTED",
    "Query",
    "QueryBus",
    "QueryHandler",
    "RPC_INTERNAL_ERROR",
    "RPC_NOT_IMPLEMENTED",
    "RPC_PATH",
    "RPC_PROCEDURE_NOT_FOUND",
    "RPC_TIMEOUT",
    "RPC_UNAVAILABLE",
    "RPC_VALIDATION_ERROR",
    "RegistrationNotFoundError",
    "RpcClient",
    "RpcError",
    "RpcNotImplementedError",
    "RpcProcedure",
    "RpcRequestFrame",
    "RpcResponseFrame",
    "RpcServer",
    "Token",
    "DEFAULT_PORTS",
    "DependencyProbe",
    "INTERNAL_ERROR",
    "METHOD_NOT_ALLOWED",
    "NOT_FOUND",
    "REQUEST_ID_HEADER",
    "SERVICE_UNAVAILABLE",
    "ServiceError",
    "ServiceSettings",
    "UPSTREAM_UNAVAILABLE",
    "VALIDATION_FAILED",
    "build_error_body",
    "configure_logging",
    "create_health_router",
    "create_rpc_router",
    "create_service_app",
    "get_request_id",
    "load_settings",
    "parse_log_level",
]
