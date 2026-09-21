"""Simulation entry point: pure, and its signature admits no bet data."""

from __future__ import annotations

from .events import generate_timeline
from .goals import sample_score
from .models import (
    MatchResult,
    ModelConfiguration,
    SimulationOutput,
    SimulationTeam,
    Winner,
)
from .probabilities import calculate_probabilities
from .seeds import create_prng, derive_seed


def derive_winner(home_goals: int, away_goals: int) -> Winner:
    """Derive the winner from the score."""
    if home_goals > away_goals:
        return "HOME"
    if away_goals > home_goals:
        return "AWAY"

    return "DRAW"


def simulate(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
) -> SimulationOutput:
    """Simulate one match; the signature admits no bet data."""
    seed = derive_seed(match_id, configuration.model_version, configuration.version)
    rng = create_prng(seed)

    probabilities = calculate_probabilities(home.strength, away.strength, configuration)
    home_goals, away_goals = sample_score(rng, probabilities)
    events, stats = generate_timeline(
        rng,
        home,
        away,
        (home_goals, away_goals),
        (probabilities.home_xg, probabilities.away_xg),
        configuration,
    )

    return SimulationOutput(
        result=MatchResult(
            match_id=match_id,
            home_goals=home_goals,
            away_goals=away_goals,
            winner=derive_winner(home_goals, away_goals),
            winning_gap=abs(home_goals - away_goals),
            seed=seed,
            model_version=configuration.model_version,
            configuration_version=configuration.version,
        ),
        probabilities=probabilities,
        events=events,
        stats=stats,
    )
