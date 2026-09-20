"""Command and query buses.

The Python services mirror the TypeScript ones: a read goes through a query
and its handler, a write through a command and its handler, and the HTTP layer
holds no domain logic of its own.

``@zudojs/cqrs`` is a TypeScript package, so this is a small independent
implementation of the same pattern rather than a port of it. It is deliberately
minimal — register a handler against a type, dispatch by type — because the
value is the separation, not the machinery.

A message is generic in its result, so ``await bus.execute(query)`` is typed
without a cast at the call site.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, TypeVar

TResult = TypeVar("TResult")


class Message(ABC, Generic[TResult]):
    """Base of a command or a query.

    ``type`` is the discriminator a bus routes on. Concrete messages declare
    it so a handler and its message cannot disagree silently.
    """

    type: str


class Command(Message[TResult]):
    """A request to change state."""


class Query(Message[TResult]):
    """A request to read state."""


TMessage = TypeVar("TMessage", bound=Message[Any])


class Handler(ABC, Generic[TMessage, TResult]):
    message_type: ClassVar[str]

    @abstractmethod
    async def execute(self, message: TMessage) -> TResult:
        """Execute the message and return its result.
        """


class CommandHandler(Handler[TMessage, TResult]):
    """Executes one command type."""


class QueryHandler(Handler[TMessage, TResult]):
    """Executes one query type."""


class HandlerNotFoundError(LookupError):
    def __init__(self, kind: str, message_type: str) -> None:
        super().__init__(f"No {kind} handler registered for {message_type!r}.")
        self.message_type = message_type


class DuplicateHandlerError(ValueError):
    def __init__(self, kind: str, message_type: str) -> None:
        super().__init__(
            f"A {kind} handler is already registered for {message_type!r}."
        )
        self.message_type = message_type


class _Bus:
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

    async def _dispatch(self, message: Message[TResult]) -> TResult:
        handler = self._handlers.get(message.type)

        if handler is None:
            raise HandlerNotFoundError(self._kind, message.type)

        result: TResult = await handler.execute(message)

        return result

    def size(self) -> int:
        return len(self._handlers)


class CommandBus(_Bus):
    def __init__(self) -> None:
        super().__init__("command")

    async def execute(self, command: Command[TResult]) -> TResult:
        return await self._dispatch(command)


class QueryBus(_Bus):
    def __init__(self) -> None:
        super().__init__("query")

    async def execute(self, query: Query[TResult]) -> TResult:
        return await self._dispatch(query)
