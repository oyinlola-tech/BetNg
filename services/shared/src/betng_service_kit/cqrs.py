"""Command and query buses.

The Python services mirror the TypeScript ones: a read goes through a query
and its handler, a write through a command and its handler, and the HTTP layer
holds no domain logic of its own.

``@zudojs/cqrs`` is a TypeScript package, so this is a small independent
implementation of the same pattern rather than a port of it. It is deliberately
minimal — register a handler against a type, dispatch by type — because the
value is the separation, not the machinery.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar


class Message(ABC):
    """Base of a command or a query.

    ``type`` is the discriminator a bus routes on. Concrete messages declare
    it as a class attribute so a handler and its message cannot disagree.
    """

    type: str


class Command(Message):
    """A request to change state."""


class Query(Message):
    """A request to read state."""


TMessage = TypeVar("TMessage", bound=Message)
TResult = TypeVar("TResult")


class Handler(ABC, Generic[TMessage, TResult]):
    """Executes one message type."""

    #: The message type this handler is registered against.
    message_type: str

    @abstractmethod
    async def execute(self, message: TMessage) -> TResult:
        """Execute the message and return its result."""


class CommandHandler(Handler[TMessage, TResult]):
    """Executes one command type."""


class QueryHandler(Handler[TMessage, TResult]):
    """Executes one query type."""


class HandlerNotFoundError(LookupError):
    """Raised when a message is dispatched with no handler registered."""

    def __init__(self, kind: str, message_type: str) -> None:
        super().__init__(f"No {kind} handler registered for {message_type!r}.")
        self.message_type = message_type


class DuplicateHandlerError(ValueError):
    """Raised when two handlers claim the same message type."""

    def __init__(self, kind: str, message_type: str) -> None:
        super().__init__(
            f"A {kind} handler is already registered for {message_type!r}."
        )
        self.message_type = message_type


class _Bus:
    """Shared registration and dispatch."""

    def __init__(self, kind: str) -> None:
        self._kind = kind
        self._handlers: dict[str, Handler[Any, Any]] = {}

    def register(self, handler: Handler[Any, Any]) -> None:
        """Register a handler against its declared message type.

        Raises:
            DuplicateHandlerError: When the type is already registered, which
                is a wiring mistake rather than something to resolve silently.
        """
        message_type = handler.message_type

        if message_type in self._handlers:
            raise DuplicateHandlerError(self._kind, message_type)

        self._handlers[message_type] = handler

    async def execute(self, message: Message) -> Any:
        """Dispatch a message to its handler.

        Raises:
            HandlerNotFoundError: When nothing is registered for the type.
        """
        handler = self._handlers.get(message.type)

        if handler is None:
            raise HandlerNotFoundError(self._kind, message.type)

        return await handler.execute(message)

    def size(self) -> int:
        """The number of registered handlers."""
        return len(self._handlers)


class CommandBus(_Bus):
    """Routes commands to their handlers."""

    def __init__(self) -> None:
        super().__init__("command")


class QueryBus(_Bus):
    """Routes queries to their handlers."""

    def __init__(self) -> None:
        super().__init__("query")
