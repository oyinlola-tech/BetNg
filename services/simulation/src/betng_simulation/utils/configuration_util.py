"""Conversion between stored parameters and the engine's configuration."""

from __future__ import annotations

import dataclasses
from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from ..dtos import ModelParametersDto
from ..engine import ModelConfiguration
from ..errors import InvalidConfigurationError

_IDENTITY_FIELDS = frozenset({"version", "model_version"})

TUNABLE_FIELDS: frozenset[str] = frozenset(
    field.name
    for field in dataclasses.fields(ModelConfiguration)
    if field.name not in _IDENTITY_FIELDS
)


def parameters_of(configuration: ModelConfiguration) -> ModelParametersDto:
    """Return the configuration's tunables as a DTO."""
    return ModelParametersDto.model_validate(
        {name: getattr(configuration, name) for name in TUNABLE_FIELDS}
    )


def parameters_to_json(configuration: ModelConfiguration) -> dict[str, Any]:
    """Return the tunables as stored camelCase JSON."""
    return parameters_of(configuration).model_dump(by_alias=True, mode="json")


def _check_consistency(configuration: ModelConfiguration) -> None:
    if configuration.min_expected_goals > configuration.max_expected_goals:
        raise InvalidConfigurationError(
            "minExpectedGoals must not exceed maxExpectedGoals."
        )

    if configuration.min_substitutions > configuration.max_substitutions:
        raise InvalidConfigurationError(
            "minSubstitutions must not exceed maxSubstitutions."
        )


def build_configuration(
    version: int,
    model_version: str,
    parameters: Mapping[str, Any],
    base: ModelConfiguration | None = None,
) -> ModelConfiguration:
    """Overlay ``parameters`` on ``base`` (the defaults when omitted)."""
    try:
        validated = ModelParametersDto.model_validate(dict(parameters))
    except ValidationError as error:
        raise InvalidConfigurationError(
            "The model parameters failed validation: "
            + "; ".join(
                f"{'.'.join(str(part) for part in issue['loc'])}: {issue['msg']}"
                for issue in error.errors()
            )
        ) from error

    overrides = {name: getattr(validated, name) for name in validated.model_fields_set}
    configuration = dataclasses.replace(
        base or ModelConfiguration(),
        version=version,
        model_version=model_version,
        **overrides,
    )
    _check_consistency(configuration)

    return configuration
