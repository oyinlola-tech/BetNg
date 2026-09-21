"""The simulation engine: pure functions, no I/O."""

from .engine import derive_winner, simulate
from .goals import sample_score
from .models import (
    MODEL_VERSION,
    EventType,
    MatchEventDraft,
    MatchResult,
    MatchStats,
    ModelConfiguration,
    ProbabilityMatrix,
    Side,
    SideStats,
    SimulationOutput,
    SimulationTeam,
    TeamStrength,
    Winner,
)
from .players import Player, Squad, squad_for
from .probabilities import (
    calculate_probabilities,
    expected_goals,
    outcome_probabilities,
    score_matrix,
)
from .seeds import create_prng, derive_seed

__all__ = [
    "MODEL_VERSION",
    "EventType",
    "MatchEventDraft",
    "MatchResult",
    "MatchStats",
    "ModelConfiguration",
    "Player",
    "ProbabilityMatrix",
    "Side",
    "SideStats",
    "SimulationOutput",
    "SimulationTeam",
    "Squad",
    "TeamStrength",
    "Winner",
    "calculate_probabilities",
    "create_prng",
    "derive_seed",
    "derive_winner",
    "expected_goals",
    "outcome_probabilities",
    "sample_score",
    "score_matrix",
    "simulate",
    "squad_for",
]
