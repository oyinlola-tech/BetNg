from __future__ import annotations

from typing import Any, Generic, TypeVar

T = TypeVar("T")


class Token(Generic[T]):
    """A unique, typed key for one registration.

    An object identity rather than a string, so two modules cannot collide on
    the same name, and the type parameter keeps ``resolve`` honest without a
    cast at the call site.
    """

    __slots__ = ("description",)

    def __init__(self, description: str) -> None:
        self.description = description

    def __repr__(self) -> str:
        return f"Token({self.description!r})"


class RegistrationNotFoundError(LookupError):
    def __init__(self, token: Token[Any]) -> None:
        super().__init__(f"Nothing is registered for {token!r}.")
        self.token = token


class Container:
    def __init__(self) -> None:
        self._values: dict[int, Any] = {}

    def register_value(self, token: Token[T], value: T) -> None:
        self._values[id(token)] = value

    def resolve(self, token: Token[T]) -> T:
        """Return the instance registered against a token.

        Raises:
            RegistrationNotFoundError: When nothing is registered, which is a
                wiring mistake and is reported rather than returning ``None``.
        """
        try:
            return self._values[id(token)]
        except KeyError:
            raise RegistrationNotFoundError(token) from None

    def has(self, token: Token[Any]) -> bool:
        return id(token) in self._values
