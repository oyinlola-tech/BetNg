"""Service configuration, read from the environment.

Every value a BetNG Python service needs is read once, at startup, into a
frozen settings object. Application code reads that object; it never reaches
for ``os.environ`` directly and never hard-codes a host or a port, so the same
image runs unchanged in docker-compose and on a developer's machine.

This mirrors what ``@betng/service-kit`` does on the TypeScript side, so the
two halves of the platform are configured the same way.
"""

from __future__ import annotations

from functools import cached_property
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "production"]

#: The port each service listens on by default, matching ``.env.example``.
DEFAULT_PORTS: dict[str, int] = {
    "gateway": 3000,
    "match": 3001,
    "betting": 3002,
    "wallet": 3003,
    "settlement": 3004,
    "simulation": 3005,
    "odds": 3006,
    "risk": 3007,
}


class ServiceSettings(BaseSettings):
    """The configuration shared by every BetNG Python service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    service_name: str
    version: str = "0.1.0"

    environment: Environment = Field(default="development", alias="NODE_ENV")
    host: str = Field(default="0.0.0.0", alias="HOST")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    simulation_service_url: str = Field(
        default="http://localhost:3005", alias="SIMULATION_SERVICE_URL"
    )
    odds_service_url: str = Field(
        default="http://localhost:3006", alias="ODDS_SERVICE_URL"
    )
    risk_service_url: str = Field(
        default="http://localhost:3007", alias="RISK_SERVICE_URL"
    )
    match_service_url: str = Field(
        default="http://localhost:3001", alias="MATCH_SERVICE_URL"
    )

    #: How long to wait on another service before giving up, in milliseconds.
    service_timeout_ms: int = Field(default=5000, alias="SERVICE_TIMEOUT_MS")

    #: Set only when this service is given an explicit port.
    port_override: int | None = Field(default=None, alias="PORT")

    @cached_property
    def port(self) -> int:
        """The port this service listens on.

        A service-specific ``<SERVICE>_PORT`` wins, so one ``.env`` can drive
        every service at once. ``PORT`` remains the override a container
        platform sets.
        """
        import os

        specific = os.environ.get(f"{self.service_name.upper()}_PORT")
        if specific:
            return _validate_port(specific)

        if self.port_override is not None:
            return self.port_override

        return DEFAULT_PORTS[self.service_name]


def _validate_port(raw: str) -> int:
    try:
        port = int(raw)
    except ValueError as error:
        raise ValueError(f"Port must be an integer, got {raw!r}.") from error

    if not 1 <= port <= 65535:
        raise ValueError(f"Port must be between 1 and 65535, got {port}.")

    return port


def load_settings(service_name: str, version: str = "0.1.0") -> ServiceSettings:
    """Read a service's configuration.

    Args:
        service_name: Which service is loading, e.g. ``"simulation"``.
        version: The service version reported by ``/health``.

    Returns:
        The frozen settings.

    Raises:
        ValueError: When a configured value cannot be used. Raised at startup
            so a misconfigured service fails before it binds a port.
    """
    try:
        return ServiceSettings(service_name=service_name, version=version)
    except ValidationError as error:
        raise ValueError(f"Invalid configuration: {error}") from error
