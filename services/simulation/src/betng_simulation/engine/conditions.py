"""Pre-match conditions: public properties of a match, never of its result."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Final, Literal

from .models import ModelConfiguration

Weather = Literal["CLEAR", "RAIN", "HEAVY_RAIN", "WIND", "HEAT"]


@dataclass(frozen=True)
class _WeatherEffect:
    share: float
    goals: float
    cards: float
    corners: float
    fatigue: float


#: Effects at full severity; ``weather_severity`` scales them towards neutral.
WEATHER_EFFECTS: Final[dict[Weather, _WeatherEffect]] = {
    "CLEAR": _WeatherEffect(0.55, 1.0, 1.0, 1.0, 1.0),
    "RAIN": _WeatherEffect(0.20, 0.94, 1.05, 1.05, 1.1),
    "HEAVY_RAIN": _WeatherEffect(0.08, 0.85, 1.1, 1.1, 1.25),
    "WIND": _WeatherEffect(0.10, 0.92, 1.0, 1.1, 1.0),
    "HEAT": _WeatherEffect(0.07, 0.95, 1.0, 1.0, 1.4),
}

_WEATHER_DESCRIPTIONS: Final[dict[Weather, str]] = {
    "CLEAR": "clear skies",
    "RAIN": "steady rain",
    "HEAVY_RAIN": "heavy rain",
    "WIND": "a strong wind",
    "HEAT": "fierce heat",
}


@dataclass(frozen=True)
class MatchConditions:
    weather: Weather
    goal_factor: float
    card_factor: float
    foul_factor: float
    corner_factor: float
    fatigue_factor: float
    referee_strictness: float

    def describe(self) -> str | None:
        if self.weather == "CLEAR":
            return None

        return _WEATHER_DESCRIPTIONS[self.weather]


NEUTRAL_CONDITIONS: Final = MatchConditions(
    weather="CLEAR",
    goal_factor=1.0,
    card_factor=1.0,
    foul_factor=1.0,
    corner_factor=1.0,
    fatigue_factor=1.0,
    referee_strictness=1.0,
)


def _unit(label: str, match_id: str) -> float:
    digest = hashlib.sha256(f"{label}:{match_id}".encode()).digest()

    return int.from_bytes(digest[:8], "big") / 2**64


def _weather_for(match_id: str) -> Weather:
    target = _unit("weather", match_id)
    cumulative = 0.0
    weather: Weather = "CLEAR"

    for weather, effect in WEATHER_EFFECTS.items():
        cumulative += effect.share
        if target < cumulative:
            return weather

    return weather


def _scaled(value: float, severity: float) -> float:
    return 1.0 + (value - 1.0) * severity


def match_conditions(
    match_id: str | None, configuration: ModelConfiguration
) -> MatchConditions:
    """Derive weather, pitch and referee from the match id and configuration.

    The inputs are public and known before kick-off, so the conditions are
    public too and price and result see the same ones.
    """
    weather: Weather = "CLEAR"
    if configuration.weather_enabled and match_id is not None:
        weather = _weather_for(match_id)

    effect = WEATHER_EFFECTS[weather]
    severity = configuration.weather_severity
    pitch = configuration.pitch_quality

    strictness = configuration.referee_strictness
    if configuration.referee_variance > 0 and match_id is not None:
        strictness *= 1.0 + configuration.referee_variance * (
            2.0 * _unit("referee", match_id) - 1.0
        )

    return MatchConditions(
        weather=weather,
        goal_factor=_scaled(effect.goals, severity) * (0.8 + 0.2 * pitch),
        card_factor=_scaled(effect.cards, severity) * strictness,
        foul_factor=(0.5 + 0.5 * strictness) * (1.0 + 0.5 * (1.0 - pitch)),
        corner_factor=_scaled(effect.corners, severity),
        fatigue_factor=_scaled(effect.fatigue, severity),
        referee_strictness=strictness,
    )
