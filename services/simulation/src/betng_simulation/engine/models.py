from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

MODEL_VERSION: Final = "poisson-1.0"

KICK_OFF_MINUTE: Final = 0
FIRST_PLAYING_MINUTE: Final = 1
HALF_TIME_MINUTE: Final = 45
SECOND_HALF_MINUTE: Final = 46
FULL_TIME_MINUTE: Final = 90

Winner = Literal["HOME", "AWAY", "DRAW"]
Side = Literal["HOME", "AWAY"]
EventType = Literal[
    "KICK_OFF",
    "GOAL",
    "YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "CORNER",
    "HALF_TIME",
    "SECOND_HALF",
    "FULL_TIME",
]


@dataclass(frozen=True)
class TeamStrength:
    attack: float
    defence: float
    midfield: float
    goalkeeping: float
    pace: float
    finishing: float
    possession: float
    form: float
    home_advantage: float


@dataclass(frozen=True)
class SimulationTeam:
    team_id: str
    name: str
    short_name: str
    strength: TeamStrength


@dataclass(frozen=True)
class ModelConfiguration:
    version: int = 1
    model_version: str = MODEL_VERSION

    base_goals: float = 1.35
    rating_scale: float = 100.0
    strength_sensitivity: float = 1.6
    home_advantage_weight: float = 0.25
    form_weight: float = 0.015
    attack_weight: float = 1.0
    finishing_weight: float = 0.5
    midfield_attack_weight: float = 0.35
    pace_weight: float = 0.15
    possession_attack_weight: float = 0.2
    defence_weight: float = 1.0
    goalkeeping_weight: float = 0.5
    midfield_defence_weight: float = 0.3
    min_expected_goals: float = 0.15
    max_expected_goals: float = 4.5

    max_goals: int = 8
    #: Dixon-Coles low-score dependence; ``None`` disables the correction.
    rho: float | None = -0.08

    first_half_goal_share: float = 0.45
    assist_probability: float = 0.7
    scorer_weight_forward: float = 5.0
    scorer_weight_midfielder: float = 3.0
    scorer_weight_defender: float = 1.0
    yellow_cards_per_team: float = 1.8
    max_yellow_cards_per_team: int = 6
    red_card_probability: float = 0.04
    corners_per_team: float = 5.0
    max_corners_per_team: int = 14
    corner_attack_weight: float = 0.6
    min_substitutions: int = 3
    max_substitutions: int = 5

    possession_rating_weight: float = 1.0
    possession_midfield_weight: float = 0.5
    possession_noise: float = 3.0
    min_possession: int = 25
    extra_shots_on_target_per_team: float = 3.0
    shots_off_target_per_team: float = 6.5
    max_extra_shots: int = 20
    fouls_per_team: float = 10.0
    max_extra_fouls: int = 25
    offsides_per_team: float = 2.0
    max_offsides: int = 10


@dataclass(frozen=True)
class MatchResult:
    match_id: str
    home_goals: int
    away_goals: int
    winner: Winner
    #: Derived from the score. Never an input.
    winning_gap: int
    seed: str
    model_version: str
    configuration_version: int


@dataclass(frozen=True)
class MatchEventDraft:
    sequence: int
    minute: int
    type: EventType
    side: Side | None
    player: str | None
    secondary_player: str | None
    score_home: int
    score_away: int
    description: str


@dataclass(frozen=True)
class SideStats:
    possession: int
    shots: int
    shots_on_target: int
    corners: int
    fouls: int
    offsides: int
    yellow_cards: int
    red_cards: int


@dataclass(frozen=True)
class MatchStats:
    as_of_minute: int
    home: SideStats
    away: SideStats


@dataclass(frozen=True)
class ProbabilityMatrix:
    home_xg: float
    away_xg: float
    max_goals: int
    #: ``cells[h][a]`` is P(home scores h, away scores a); the cells sum to 1.
    cells: tuple[tuple[float, ...], ...]


@dataclass(frozen=True)
class SimulationOutput:
    result: MatchResult
    probabilities: ProbabilityMatrix
    events: tuple[MatchEventDraft, ...]
    stats: MatchStats
