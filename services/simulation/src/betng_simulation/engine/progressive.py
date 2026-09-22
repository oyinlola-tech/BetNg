"""The progressive model: a match played minute by minute from one PRNG.

The core process (goals, cards, substitutions, stoppage time) is all that
decides the score. Pricing runs the core alone; a result run adds the
narration (players, corners, shots, possession), which draws from the same
PRNG but never feeds back into a rate, so both share one score distribution.
"""

from __future__ import annotations

import functools
import random
from dataclasses import dataclass, field
from typing import Final

from .conditions import NEUTRAL_CONDITIONS, MatchConditions
from .models import (
    FULL_TIME_MINUTE,
    HALF_TIME_MINUTE,
    SECOND_HALF_MINUTE,
    ModelConfiguration,
    Side,
    TeamStrength,
)
from .probabilities import expected_goals
from .sampling import sample_choice, sample_int, sample_weighted

SLOTS: Final = 11
GOALKEEPER_SLOT: Final = 0
OUTFIELD_SLOTS: Final = tuple(range(1, SLOTS))
LAST_SUBSTITUTION_MINUTE: Final = 88
MAX_RATE: Final = 0.3


LEVEL: Final = 0
LEADING: Final = 1
TRAILING_BY_ONE: Final = 2
TRAILING_BY_MORE: Final = 3


def state_class(difference: int) -> int:
    if difference > 0:
        return LEADING
    if difference == 0:
        return LEVEL
    if difference == -1:
        return TRAILING_BY_ONE

    return TRAILING_BY_MORE


@dataclass(slots=True)
class TeamState:
    goal_scale: float
    base_yellow: float
    base_red: float
    fatigue_scale: float
    goals: int = 0
    yellows: int = 0
    reds: int = 0
    substitutions: int = 0
    concession: float = 1.0
    momentum_until: int = -1
    rattled_until: int = -1
    yellow_rate: float = 0.0
    red_rate: float = 0.0
    xg: float = 0.0
    booked: list[bool] = field(default_factory=lambda: [False] * SLOTS)
    sent_off: list[bool] = field(default_factory=lambda: [False] * SLOTS)
    fresh: list[bool] = field(default_factory=lambda: [False] * SLOTS)
    substitution_minutes: list[int] = field(default_factory=list)


def period_factor(minute: int, configuration: ModelConfiguration) -> float:
    share = configuration.first_half_goal_share
    return 2.0 * share if minute <= HALF_TIME_MINUTE else 2.0 * (1.0 - share)


def game_state_factor(
    state: int, minute: int, configuration: ModelConfiguration
) -> float:
    """Return the scoring multiplier for a side in ``state`` at ``minute``."""
    pressure = min(minute, FULL_TIME_MINUTE) / FULL_TIME_MINUTE

    if state == LEADING:
        return (1.0 + (configuration.leading_attack_factor - 1.0) * pressure) * (
            1.0 + (configuration.counter_attack_factor - 1.0) * pressure
        )
    if state == LEVEL:
        return 1.0

    factor = 1.0 + (configuration.trailing_attack_factor - 1.0) * pressure
    if state == TRAILING_BY_ONE and minute >= configuration.late_urgency_minute:
        factor *= configuration.late_urgency_factor

    return factor


@dataclass(frozen=True)
class RateModel:
    """Per-minute intensities for one configuration and set of conditions."""

    configuration: ModelConfiguration
    conditions: MatchConditions
    #: ``tables[state][minute]``: period x game-state multiplier.
    tables: tuple[tuple[float, ...], ...]
    peaks: tuple[float, ...]

    @classmethod
    def build(
        cls,
        configuration: ModelConfiguration,
        conditions: MatchConditions = NEUTRAL_CONDITIONS,
    ) -> RateModel:
        return _cached_rate_model(configuration, conditions)

    @classmethod
    def _build(
        cls, configuration: ModelConfiguration, conditions: MatchConditions
    ) -> RateModel:
        tables = tuple(
            tuple(
                period_factor(minute, configuration)
                * game_state_factor(state, minute, configuration)
                for minute in range(FULL_TIME_MINUTE + 1)
            )
            for state in (LEVEL, LEADING, TRAILING_BY_ONE, TRAILING_BY_MORE)
        )

        return cls(
            configuration=configuration,
            conditions=conditions,
            tables=tables,
            peaks=tuple(max(table) for table in tables),
        )

    def new_team(self, xg: float, strength: TeamStrength) -> TeamState:
        configuration = self.configuration
        minutes = configuration.effective_minutes
        team = TeamState(
            goal_scale=xg / minutes * self.conditions.goal_factor,
            base_yellow=configuration.yellow_cards_per_team / minutes,
            base_red=configuration.red_card_probability / minutes,
            fatigue_scale=1.5 - strength.pace / 100.0,
        )

        return team

    def fatigue_level(self, team: TeamState, minute: int) -> float:
        configuration = self.configuration
        if not configuration.fatigue_enabled:
            return 0.0

        tired_minutes = minute - configuration.fatigue_onset_minute
        if tired_minutes <= 0:
            return 0.0

        fresh_share = min(team.substitutions, SLOTS - 1) / (SLOTS - 1)

        return min(
            configuration.fatigue_rate
            * tired_minutes
            * (1.0 - fresh_share)
            * team.fatigue_scale
            * self.conditions.fatigue_factor,
            0.5,
        )

    def goal_rate(
        self, attacking: TeamState, defending: TeamState, minute: int, step: int
    ) -> float:
        """Return P(``attacking`` scores in this minute) given the match state."""
        configuration = self.configuration
        rate = (
            attacking.goal_scale
            * defending.concession
            * self.tables[state_class(attacking.goals - defending.goals)][minute]
        )

        # Apply tactical formation modifiers
        rate *= configuration.formation_attack_modifier
        rate *= configuration.formation_defence_modifier

        if step <= attacking.momentum_until:
            rate *= 1.0 + configuration.momentum_boost * (
                (attacking.momentum_until - step + 1) / configuration.momentum_minutes
            )
        if step <= defending.rattled_until:
            rate *= 1.0 + configuration.concede_vulnerability * (
                (defending.rattled_until - step + 1) / configuration.momentum_minutes
            )
        if configuration.fatigue_enabled:
            rate *= (1.0 - self.fatigue_level(attacking, minute)) * (
                1.0 + self.fatigue_level(defending, minute)
            )

        return min(rate, MAX_RATE)

    def card_rates(self, team: TeamState, opponent: TeamState) -> tuple[float, float]:
        """Return P(yellow) and P(straight red) for ``team`` in one minute."""
        configuration = self.configuration
        factor = self.conditions.card_factor
        if team.goals < opponent.goals:
            factor *= configuration.trailing_card_factor

        yellow = (
            0.0
            if team.yellows >= configuration.max_yellow_cards_per_team
            else team.base_yellow * factor
        )
        red = (
            0.0
            if team.reds >= configuration.max_red_cards_per_team
            else team.base_red * factor
        )

        return min(yellow, MAX_RATE), min(red, MAX_RATE)

    def refresh_cards(self, home: TeamState, away: TeamState) -> None:
        home.yellow_rate, home.red_rate = self.card_rates(home, away)
        away.yellow_rate, away.red_rate = self.card_rates(away, home)


@functools.lru_cache(maxsize=128)
def _cached_rate_model(
    configuration: ModelConfiguration, conditions: MatchConditions
) -> RateModel:
    return RateModel._build(configuration, conditions)


class Narrator:
    """Receives the core's events; a pricing run has none."""

    def begin_half(self, half: int) -> None: ...

    def end_half(self, half: int, added: int) -> None: ...

    def minute(
        self,
        minute: int,
        added: int,
        home: TeamState,
        away: TeamState,
        home_rate: float,
        away_rate: float,
    ) -> None: ...

    def goal(self, side: Side, minute: int, added: int) -> None: ...

    def yellow_card(self, side: Side, slot: int, minute: int, added: int) -> None: ...

    def red_card(
        self, side: Side, slot: int, minute: int, added: int, *, second_yellow: bool
    ) -> None: ...

    def substitution(self, side: Side, slot: int, minute: int) -> None: ...


@dataclass(frozen=True)
class CoreOutcome:
    home_goals: int
    away_goals: int
    home: TeamState
    away: TeamState
    first_half_added: int
    second_half_added: int


class _HalfCounts:
    __slots__ = ("cards", "goals", "substitutions")

    def __init__(self) -> None:
        self.goals = 0
        self.cards = 0
        self.substitutions = 0


def _draw_substitutions(
    rng: random.Random, configuration: ModelConfiguration
) -> list[int]:
    count = sample_int(
        rng, configuration.min_substitutions, configuration.max_substitutions
    )

    return sorted(
        sample_int(rng, SECOND_HALF_MINUTE, LAST_SUBSTITUTION_MINUTE)
        for _ in range(count)
    )


def stoppage_minutes(
    goals: int,
    cards: int,
    substitutions: int,
    base: float,
    cap: int,
    configuration: ModelConfiguration,
) -> int:
    added = (
        base
        + configuration.stoppage_per_goal * goals
        + configuration.stoppage_per_card * cards
        + configuration.stoppage_per_substitution * substitutions
    )

    return max(0, min(int(added + 0.5), cap))


_Cached = tuple[
    float,
    float,
    tuple[float, ...],
    tuple[float, ...],
    float,
    bool,
    int,
    int,
    int,
    int,
    int,
]


class _Match:
    """One run of the core process; ``narrator`` is ``None`` when pricing."""

    def __init__(
        self,
        rng: random.Random,
        model: RateModel,
        home: TeamState,
        away: TeamState,
        narrator: Narrator | None,
    ) -> None:
        self.rng = rng
        self.model = model
        self.configuration = model.configuration
        self.home = home
        self.away = away
        self.narrator = narrator
        self.step = 0
        self.counts = _HalfCounts()

    def play(self) -> CoreOutcome:
        configuration = self.configuration
        narrator = self.narrator
        self.model.refresh_cards(self.home, self.away)
        added_by_half: list[int] = []

        for half, first, last, base, cap in (
            (
                1,
                1,
                HALF_TIME_MINUTE,
                configuration.stoppage_first_half_base,
                configuration.max_stoppage_first_half,
            ),
            (
                2,
                SECOND_HALF_MINUTE,
                FULL_TIME_MINUTE,
                configuration.stoppage_second_half_base,
                configuration.max_stoppage_second_half,
            ),
        ):
            self.counts = _HalfCounts()
            if narrator is not None:
                narrator.begin_half(half)
            self._steps(first, last - first + 1, stoppage=False)
            counts = self.counts
            added = stoppage_minutes(
                counts.goals,
                counts.cards,
                counts.substitutions,
                base,
                cap,
                configuration,
            )
            self._steps(last, added, stoppage=True)
            added_by_half.append(added)
            if narrator is not None:
                narrator.end_half(half, added)

        return CoreOutcome(
            home_goals=self.home.goals,
            away_goals=self.away.goals,
            home=self.home,
            away=self.away,
            first_half_added=added_by_half[0],
            second_half_added=added_by_half[1],
        )

    def _state(self) -> _Cached:
        home, away, model = self.home, self.away, self.model
        configuration = self.configuration
        home_class = state_class(home.goals - away.goals)
        away_class = state_class(away.goals - home.goals)
        home_scale = home.goal_scale * away.concession
        away_scale = away.goal_scale * home.concession
        home_peak = home_scale * model.peaks[home_class]
        away_peak = away_scale * model.peaks[away_class]
        momentum_peak = (1.0 + configuration.momentum_boost) * (
            1.0 + configuration.concede_vulnerability
        )
        home_pending = home.substitution_minutes
        away_pending = away.substitution_minutes

        return (
            home_scale,
            away_scale,
            model.tables[home_class],
            model.tables[away_class],
            home.yellow_rate + away.yellow_rate + home.red_rate + away.red_rate,
            configuration.fatigue_enabled
            or max(home_peak, away_peak) * momentum_peak > MAX_RATE,
            home.momentum_until,
            home.rattled_until,
            away.momentum_until,
            away.rattled_until,
            min(
                home_pending[0] if home_pending else FULL_TIME_MINUTE + 1,
                away_pending[0] if away_pending else FULL_TIME_MINUTE + 1,
            ),
        )

    def _steps(self, start: int, count: int, *, stoppage: bool) -> None:
        home, away, model = self.home, self.away, self.model
        configuration = self.configuration
        narrator = self.narrator
        random_unit = self.rng.random
        boost = configuration.momentum_boost
        vulnerability = configuration.concede_vulnerability
        window = configuration.momentum_minutes or 1
        (
            home_scale,
            away_scale,
            home_table,
            away_table,
            cards,
            exact,
            home_momentum,
            home_rattled,
            away_momentum,
            away_rattled,
            next_substitution,
        ) = self._state()
        step = self.step
        home_xg = away_xg = 0.0
        minute = start
        added = 0

        for index in range(count):
            if stoppage:
                added = index + 1
            else:
                minute = start + index
            step += 1

            if exact:
                self.step = step
                home_rate = model.goal_rate(home, away, minute, step)
                away_rate = model.goal_rate(away, home, minute, step)
            else:
                home_rate = home_scale * home_table[minute]
                away_rate = away_scale * away_table[minute]
                if step <= home_momentum:
                    home_rate *= 1.0 + boost * (home_momentum - step + 1) / window
                if step <= away_rattled:
                    home_rate *= (
                        1.0 + vulnerability * (away_rattled - step + 1) / window
                    )
                if step <= away_momentum:
                    away_rate *= 1.0 + boost * (away_momentum - step + 1) / window
                if step <= home_rattled:
                    away_rate *= (
                        1.0 + vulnerability * (home_rattled - step + 1) / window
                    )
            home_xg += home_rate
            away_xg += away_rate
            if narrator is not None:
                narrator.minute(minute, added, home, away, home_rate, away_rate)

            if random_unit() < home_rate + away_rate + cards:
                self.step = step
                self._event(minute, added, home_rate, away_rate)
                changed = True
            else:
                changed = False
            if minute == next_substitution and not stoppage:
                self.step = step
                self._substitutions("HOME", home, minute)
                self._substitutions("AWAY", away, minute)
                changed = True
            if changed:
                (
                    home_scale,
                    away_scale,
                    home_table,
                    away_table,
                    cards,
                    exact,
                    home_momentum,
                    home_rattled,
                    away_momentum,
                    away_rattled,
                    next_substitution,
                ) = self._state()

        self.step = step
        home.xg += home_xg
        away.xg += away_xg

    def _event(
        self, minute: int, added: int, home_rate: float, away_rate: float
    ) -> None:
        home, away = self.home, self.away
        target = self.rng.random() * (
            home_rate
            + away_rate
            + home.yellow_rate
            + away.yellow_rate
            + home.red_rate
            + away.red_rate
        )
        threshold = home_rate
        if target < threshold:
            self._goal("HOME", home, away, minute, added)
        elif target < (threshold := threshold + away_rate):
            self._goal("AWAY", away, home, minute, added)
        elif target < (threshold := threshold + home.yellow_rate):
            self._yellow("HOME", home, minute, added)
        elif target < (threshold := threshold + away.yellow_rate):
            self._yellow("AWAY", away, minute, added)
        elif target < (threshold := threshold + home.red_rate):
            self._straight_red("HOME", home, minute, added)
        else:
            self._straight_red("AWAY", away, minute, added)

        self.model.refresh_cards(home, away)

    def _goal(
        self,
        side: Side,
        scorer: TeamState,
        conceder: TeamState,
        minute: int,
        added: int,
    ) -> None:
        window = self.configuration.momentum_minutes
        scorer.goals += 1
        self.counts.goals += 1
        scorer.momentum_until = self.step + window
        scorer.rattled_until = -1
        conceder.momentum_until = -1
        conceder.rattled_until = self.step + window
        if self.narrator is not None:
            self.narrator.goal(side, minute, added)

    def _pick(self, team: TeamState, *, cautious: bool) -> int | None:
        candidates = [slot for slot in OUTFIELD_SLOTS if not team.sent_off[slot]]
        if not candidates:
            return None
        if not cautious:
            return sample_choice(self.rng, candidates)

        caution = self.configuration.booked_player_caution
        weights = [caution if team.booked[slot] else 1.0 for slot in candidates]

        return sample_weighted(self.rng, candidates, weights)

    def _yellow(self, side: Side, team: TeamState, minute: int, added: int) -> None:
        configuration = self.configuration
        slot = self._pick(team, cautious=True)
        if slot is None:
            return
        if team.booked[slot] and team.reds >= configuration.max_red_cards_per_team:
            return

        team.yellows += 1
        self.counts.cards += 1
        if self.narrator is not None:
            self.narrator.yellow_card(side, slot, minute, added)

        if team.booked[slot]:
            self._send_off(team, slot)
            if self.narrator is not None:
                self.narrator.red_card(side, slot, minute, added, second_yellow=True)
        else:
            team.booked[slot] = True

    def _straight_red(
        self, side: Side, team: TeamState, minute: int, added: int
    ) -> None:
        slot = self._pick(team, cautious=False)
        if slot is None:
            return

        self.counts.cards += 1
        self._send_off(team, slot)
        if self.narrator is not None:
            self.narrator.red_card(side, slot, minute, added, second_yellow=False)

    def _send_off(self, team: TeamState, slot: int) -> None:
        configuration = self.configuration
        random_unit = self.rng.random
        team.sent_off[slot] = True
        team.reds += 1
        attack_low = configuration.red_card_attack_penalty_min
        attack_high = configuration.red_card_attack_penalty_max
        defence_low = configuration.red_card_defence_penalty_min
        defence_high = configuration.red_card_defence_penalty_max
        team.goal_scale *= 1.0 - (
            attack_low + (attack_high - attack_low) * random_unit()
        )
        team.concession *= 1.0 + (
            defence_low + (defence_high - defence_low) * random_unit()
        )

    def _substitutions(self, side: Side, team: TeamState, minute: int) -> None:
        pending = team.substitution_minutes
        while pending and pending[0] == minute:
            pending.pop(0)
            candidates = [
                slot
                for slot in OUTFIELD_SLOTS
                if not team.sent_off[slot] and not team.fresh[slot]
            ]
            if not candidates:
                continue

            slot = sample_choice(self.rng, candidates)
            team.fresh[slot] = True
            team.booked[slot] = False
            team.substitutions += 1
            self.counts.substitutions += 1

            # Apply freshness boost: reduce fatigue for the substituted player
            if self.configuration.fatigue_enabled:
                team.fatigue_scale *= 1.0 - self.configuration.substitution_fresh_boost / SLOTS

            if self.narrator is not None:
                self.narrator.substitution(side, slot, minute)


def play_core(
    rng: random.Random,
    home_strength: TeamStrength,
    away_strength: TeamStrength,
    model: RateModel,
    narrator: Narrator | None = None,
    expected: tuple[float, float] | None = None,
) -> CoreOutcome:
    """Play one match's core process; every draw comes from ``rng``."""
    configuration = model.configuration
    home_xg, away_xg = expected or expected_goals(
        home_strength, away_strength, configuration
    )
    home = model.new_team(home_xg, home_strength)
    away = model.new_team(away_xg, away_strength)
    home.substitution_minutes = _draw_substitutions(rng, configuration)
    away.substitution_minutes = _draw_substitutions(rng, configuration)

    return _Match(rng, model, home, away, narrator).play()
