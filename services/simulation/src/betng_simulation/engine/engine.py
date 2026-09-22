from __future__ import annotations

from .events import generate_timeline
from .goals import sample_score
from .models import (
    LEGACY_MODEL_VERSION,
    PROGRESSIVE_MODEL_VERSION,
    MatchResult,
    ModelConfiguration,
    SimulationOutput,
    SimulationTeam,
    UnknownModelVersionError,
    derive_winner,
)
from .probabilities import calculate_probabilities
from .seeds import create_prng, derive_seed
from .timeline import simulate_progressive


def _simulate_legacy(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    seed: str,
) -> SimulationOutput:
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
        home_xg=probabilities.home_xg,
        away_xg=probabilities.away_xg,
    )


def simulate_with_seed(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    seed: str,
) -> SimulationOutput:
    """Replay a run from its recorded seed under its own model version."""
    if configuration.model_version == LEGACY_MODEL_VERSION:
        return _simulate_legacy(match_id, home, away, configuration, seed)
    if configuration.model_version == PROGRESSIVE_MODEL_VERSION:
        return simulate_progressive(match_id, home, away, configuration, seed)

    raise UnknownModelVersionError(
        f"Unknown model version {configuration.model_version!r}."
    )


def simulate(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    seed_secret: str | None = None,
) -> SimulationOutput:
    seed = derive_seed(
        match_id, configuration.model_version, configuration.version, seed_secret
    )

    return simulate_with_seed(match_id, home, away, configuration, seed)
