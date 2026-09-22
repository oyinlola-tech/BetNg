from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

LEGACY_MODEL_VERSION: Final = "poisson-1.0"
PROGRESSIVE_MODEL_VERSION: Final = "progressive-2.0"
MODEL_VERSION: Final = PROGRESSIVE_MODEL_VERSION
MODEL_VERSIONS: Final[tuple[str, ...]] = (
    LEGACY_MODEL_VERSION,
    PROGRESSIVE_MODEL_VERSION,
)

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

    effective_minutes: float = 104.0
    stoppage_first_half_base: float = 1.0
    stoppage_second_half_base: float = 2.0
    stoppage_per_goal: float = 0.5
    stoppage_per_card: float = 0.3
    stoppage_per_substitution: float = 0.3
    max_stoppage_first_half: int = 5
    max_stoppage_second_half: int = 8
    leading_attack_factor: float = 0.85
    trailing_attack_factor: float = 1.2
    counter_attack_factor: float = 1.15
    late_urgency_minute: int = 75
    late_urgency_factor: float = 1.2
    red_card_attack_penalty_min: float = 0.15
    red_card_attack_penalty_max: float = 0.35
    red_card_defence_penalty_min: float = 0.2
    red_card_defence_penalty_max: float = 0.5
    max_red_cards_per_team: int = 3
    booked_player_caution: float = 0.35
    trailing_card_factor: float = 1.2
    momentum_boost: float = 0.2
    concede_vulnerability: float = 0.1
    momentum_minutes: int = 5
    possession_state_shift: float = 3.0
    possession_red_card_shift: float = 5.0
    pricing_simulations: int = 5000

    weather_enabled: bool = False
    weather_severity: float = 0.5
    pitch_quality: float = 1.0
    referee_strictness: float = 1.0
    referee_variance: float = 0.0
    fatigue_enabled: bool = False
    fatigue_onset_minute: int = 60
    fatigue_rate: float = 0.005

    #: Tactical formation effects on scoring rates
    formation_attack_modifier: float = 1.0
    formation_defence_modifier: float = 1.0
    formation_midfield_modifier: float = 1.0

    #: Position-specific fatigue rates (multiplied by base fatigue_rate)
    fatigue_rate_forward: float = 1.2
    fatigue_rate_midfielder: float = 1.0
    fatigue_rate_defender: float = 0.8
    fatigue_rate_goalkeeper: float = 0.6

    #: Substitution freshness boost (reduces fatigue for the substituted player)
    substitution_fresh_boost: float = 0.3


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
    #: The legacy model's pre-match matrix; ``None`` for the progressive model.
    probabilities: ProbabilityMatrix | None
    events: tuple[MatchEventDraft, ...]
    stats: MatchStats
    home_xg: float
    away_xg: float


def derive_winner(home_goals: int, away_goals: int) -> Winner:
    if home_goals > away_goals:
        return "HOME"
    if away_goals > home_goals:
        return "AWAY"

    return "DRAW"


class UnknownModelVersionError(ValueError):
    """The configuration names a model this build cannot run."""
