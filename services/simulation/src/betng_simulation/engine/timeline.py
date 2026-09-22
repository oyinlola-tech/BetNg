"""Narration for the progressive model: players, corners, shots and possession.

It only reads the core's state and draws from the same PRNG; nothing here
changes a scoring rate, so the score distribution is the core's alone.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Final

from .conditions import MatchConditions, match_conditions
from .models import (
    FULL_TIME_MINUTE,
    HALF_TIME_MINUTE,
    KICK_OFF_MINUTE,
    SECOND_HALF_MINUTE,
    EventType,
    MatchEventDraft,
    MatchResult,
    MatchStats,
    ModelConfiguration,
    Side,
    SideStats,
    SimulationOutput,
    SimulationTeam,
    derive_winner,
)
from .players import EXPANDED_NAME_POOL, Player, squad_for
from .probabilities import defensive_rating, expected_goals, offensive_rating
from .progressive import Narrator, RateModel, TeamState, period_factor, play_core
from .sampling import sample_choice, sample_poisson, sample_weighted
from .seeds import create_prng

MAX_DESCRIPTION_LENGTH: Final = 240
FULL_POSSESSION: Final = 100
EVEN_POSSESSION: Final = 50.0
MIN_PRESSURE: Final = 0.5
MAX_PRESSURE: Final = 2.5
MAX_DEFICIT_SHIFT: Final = 2


@dataclass
class _Lineup:
    side: Side
    team: SimulationTeam
    on_pitch: list[Player | None]
    bench: list[Player]
    neutral_scale: float
    corner_rate: float
    corners: int = 0
    shots_on_target: int = 0
    extra_on_target: float = 0.0
    off_target: float = 0.0
    fouls: float = 0.0
    offsides: float = 0.0
    yellow_cards: int = 0
    red_cards: int = 0


def _corner_rate(
    attacking: SimulationTeam,
    defending: SimulationTeam,
    configuration: ModelConfiguration,
    conditions: MatchConditions,
) -> float:
    gap = (
        offensive_rating(attacking.strength, configuration)
        - defensive_rating(defending.strength, configuration)
    ) / configuration.rating_scale
    per_match = max(
        configuration.corners_per_team
        * (1.0 + configuration.corner_attack_weight * gap),
        0.0,
    )

    return per_match * conditions.corner_factor / configuration.effective_minutes


def _clock(minute: int, added: int) -> str:
    return f"{minute}+{added}' " if added else ""


class TimelineNarrator(Narrator):
    def __init__(
        self,
        rng: random.Random,
        home: SimulationTeam,
        away: SimulationTeam,
        expected: tuple[float, float],
        configuration: ModelConfiguration,
        conditions: MatchConditions,
    ) -> None:
        self.rng = rng
        self.configuration = configuration
        self.conditions = conditions
        minutes = configuration.effective_minutes
        self.lineups: dict[Side, _Lineup] = {}
        sides: tuple[tuple[Side, SimulationTeam, SimulationTeam, float], ...] = (
            ("HOME", home, away, expected[0]),
            ("AWAY", away, home, expected[1]),
        )
        for side, team, opponent, xg in sides:
            squad = squad_for(team.team_id, EXPANDED_NAME_POOL)
            self.lineups[side] = _Lineup(
                side=side,
                team=team,
                on_pitch=list(squad.starters),
                bench=list(squad.bench),
                neutral_scale=xg / minutes * conditions.goal_factor,
                corner_rate=_corner_rate(team, opponent, configuration, conditions),
            )
        self.events: list[MatchEventDraft] = []
        self.score = {"HOME": 0, "AWAY": 0}
        self.possession_total = 0.0
        self.minutes_played = 0
        self.base_share = self._base_share(home, away)
        per_minute = 1.0 / minutes
        self.periods = tuple(
            period_factor(minute, configuration)
            for minute in range(FULL_TIME_MINUTE + 1)
        )
        self.on_target_per_goal = (
            configuration.extra_shots_on_target_per_team / configuration.base_goals
        )
        self.off_target_per_goal = (
            configuration.shots_off_target_per_team / configuration.base_goals
        )
        self.offsides_per_minute = configuration.offsides_per_team * per_minute
        self.fouls_per_minute = (
            configuration.fouls_per_team * per_minute * conditions.foul_factor
        )
        self.trailing_fouls_per_minute = (
            self.fouls_per_minute * configuration.trailing_card_factor
        )
        self.state_shift = configuration.possession_state_shift / FULL_TIME_MINUTE
        self.red_card_shift = configuration.possession_red_card_shift

        weather = conditions.describe()
        venue = f" in {weather}" if weather else ""
        self._add(
            KICK_OFF_MINUTE,
            "KICK_OFF",
            f"Kick-off{venue}: {home.name} v {away.name}.",
        )

    def _base_share(self, home: SimulationTeam, away: SimulationTeam) -> float:
        configuration = self.configuration

        def control(team: SimulationTeam) -> float:
            return (
                team.strength.possession * configuration.possession_rating_weight
                + team.strength.midfield * configuration.possession_midfield_weight
            )

        total = control(home) + control(away)

        return EVEN_POSSESSION if total <= 0 else control(home) / total * 100.0

    def _scoreline(self) -> str:
        home, away = self.lineups["HOME"].team, self.lineups["AWAY"].team

        return (
            f"{home.short_name} {self.score['HOME']}-{self.score['AWAY']} "
            f"{away.short_name}"
        )

    def _add(
        self,
        minute: int,
        event_type: EventType,
        description: str,
        *,
        side: Side | None = None,
        player: str | None = None,
        secondary_player: str | None = None,
    ) -> None:
        self.events.append(
            MatchEventDraft(
                sequence=len(self.events) + 1,
                minute=minute,
                type=event_type,
                side=side,
                player=player,
                secondary_player=secondary_player,
                score_home=self.score["HOME"],
                score_away=self.score["AWAY"],
                description=description[:MAX_DESCRIPTION_LENGTH],
            )
        )

    def begin_half(self, half: int) -> None:
        if half == 2:
            self._add(
                SECOND_HALF_MINUTE, "SECOND_HALF", "The second half is under way."
            )

    def end_half(self, half: int, added: int) -> None:
        stoppage = f" after {added} added minutes" if added else ""
        if half == 1:
            self._add(
                HALF_TIME_MINUTE,
                "HALF_TIME",
                f"Half-time{stoppage}: {self._scoreline()}.",
            )
        else:
            self._add(
                FULL_TIME_MINUTE,
                "FULL_TIME",
                f"Full-time{stoppage}: {self._scoreline()}.",
            )

    def minute(
        self,
        minute: int,
        added: int,
        home: TeamState,
        away: TeamState,
        home_rate: float,
        away_rate: float,
    ) -> None:
        period = self.periods[minute]
        home_lineup = self.lineups["HOME"]
        away_lineup = self.lineups["AWAY"]
        self._pressing(
            home_lineup, minute, added, home_rate, period, home.goals < away.goals
        )
        self._pressing(
            away_lineup, minute, added, away_rate, period, away.goals < home.goals
        )

        deficit = max(
            min(away.goals - home.goals, MAX_DEFICIT_SHIFT), -MAX_DEFICIT_SHIFT
        )
        self.possession_total += (
            self.base_share
            + self.state_shift * deficit * min(minute, FULL_TIME_MINUTE)
            + self.red_card_shift * (away.reds - home.reds)
        )
        self.minutes_played += 1

    def _pressing(
        self,
        lineup: _Lineup,
        minute: int,
        added: int,
        rate: float,
        period: float,
        trailing: bool,
    ) -> None:
        neutral = lineup.neutral_scale * period
        pressure = rate / neutral if neutral > 0 else 1.0
        if pressure < MIN_PRESSURE:
            pressure = MIN_PRESSURE
        elif pressure > MAX_PRESSURE:
            pressure = MAX_PRESSURE

        lineup.extra_on_target += self.on_target_per_goal * rate
        lineup.off_target += self.off_target_per_goal * rate
        lineup.offsides += self.offsides_per_minute * pressure
        lineup.fouls += (
            self.trailing_fouls_per_minute if trailing else self.fouls_per_minute
        )

        if (
            lineup.corners < self.configuration.max_corners_per_team
            and self.rng.random() < lineup.corner_rate * pressure
        ):
            lineup.corners += 1
            self._add(
                minute,
                "CORNER",
                f"{_clock(minute, added)}Corner to {lineup.team.name}.",
                side=lineup.side,
            )

    def _scorer_weight(self, player: Player) -> float:
        configuration = self.configuration
        if player.position == "FORWARD":
            return configuration.scorer_weight_forward
        if player.position == "MIDFIELDER":
            return configuration.scorer_weight_midfielder
        if player.position == "DEFENDER":
            return configuration.scorer_weight_defender

        return 0.0

    def goal(self, side: Side, minute: int, added: int) -> None:
        lineup = self.lineups[side]
        candidates = [
            player
            for player in lineup.on_pitch
            if player is not None and player.position != "GOALKEEPER"
        ]
        scorer = sample_weighted(
            self.rng,
            candidates,
            [self._scorer_weight(player) for player in candidates],
        )
        assist: Player | None = None
        if self.rng.random() < self.configuration.assist_probability:
            others = [player for player in candidates if player is not scorer]
            if others:
                assist = sample_choice(self.rng, others)

        self.score[side] += 1
        lineup.shots_on_target += 1
        credit = f", assisted by {assist.name}" if assist else ""
        self._add(
            minute,
            "GOAL",
            f"{_clock(minute, added)}Goal for {lineup.team.name}! {scorer.name} "
            f"scores{credit}. {self._scoreline()}.",
            side=side,
            player=scorer.name,
            secondary_player=assist.name if assist else None,
        )

    def yellow_card(self, side: Side, slot: int, minute: int, added: int) -> None:
        lineup = self.lineups[side]
        player = lineup.on_pitch[slot]
        if player is None:
            return

        lineup.yellow_cards += 1
        self._add(
            minute,
            "YELLOW_CARD",
            f"{_clock(minute, added)}Yellow card for {player.name} "
            f"({lineup.team.name}).",
            side=side,
            player=player.name,
        )

    def red_card(
        self, side: Side, slot: int, minute: int, added: int, *, second_yellow: bool
    ) -> None:
        lineup = self.lineups[side]
        player = lineup.on_pitch[slot]
        if player is None:
            return

        lineup.on_pitch[slot] = None
        lineup.red_cards += 1
        reason = " after a second yellow" if second_yellow else ""
        self._add(
            minute,
            "RED_CARD",
            f"{_clock(minute, added)}Red card! {player.name} ({lineup.team.name}) "
            f"is sent off{reason}.",
            side=side,
            player=player.name,
        )

    def substitution(self, side: Side, slot: int, minute: int) -> None:
        lineup = self.lineups[side]
        leaving = lineup.on_pitch[slot]
        arriving_candidates = [
            player for player in lineup.bench if player.position != "GOALKEEPER"
        ]
        if leaving is None or not arriving_candidates:
            return

        like_for_like = [
            player
            for player in arriving_candidates
            if player.position == leaving.position
        ]
        arriving = sample_choice(self.rng, like_for_like or arriving_candidates)
        lineup.on_pitch[slot] = arriving
        lineup.bench.remove(arriving)
        self._add(
            minute,
            "SUBSTITUTION",
            f"Substitution for {lineup.team.name}: {arriving.name} replaces "
            f"{leaving.name}.",
            side=side,
            player=arriving.name,
            secondary_player=leaving.name,
        )

    def _side_stats(self, side: Side, possession: int) -> SideStats:
        configuration = self.configuration
        lineup = self.lineups[side]
        shots_on_target = lineup.shots_on_target + sample_poisson(
            self.rng, lineup.extra_on_target, configuration.max_extra_shots
        )
        shots = shots_on_target + sample_poisson(
            self.rng, lineup.off_target, configuration.max_extra_shots
        )
        cards = lineup.yellow_cards + lineup.red_cards

        return SideStats(
            possession=possession,
            shots=shots,
            shots_on_target=shots_on_target,
            corners=lineup.corners,
            fouls=cards
            + sample_poisson(self.rng, lineup.fouls, configuration.max_extra_fouls),
            offsides=sample_poisson(
                self.rng, lineup.offsides, configuration.max_offsides
            ),
            yellow_cards=lineup.yellow_cards,
            red_cards=lineup.red_cards,
        )

    def stats(self) -> MatchStats:
        configuration = self.configuration
        average = self.possession_total / max(self.minutes_played, 1)
        average += (self.rng.random() * 2.0 - 1.0) * configuration.possession_noise
        home_possession = min(
            max(round(average), configuration.min_possession),
            FULL_POSSESSION - configuration.min_possession,
        )

        return MatchStats(
            as_of_minute=FULL_TIME_MINUTE,
            home=self._side_stats("HOME", home_possession),
            away=self._side_stats("AWAY", FULL_POSSESSION - home_possession),
        )


def simulate_progressive(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    seed: str,
) -> SimulationOutput:
    rng = create_prng(seed)
    conditions = match_conditions(match_id, configuration)
    model = RateModel.build(configuration, conditions)
    expected = expected_goals(home.strength, away.strength, configuration)
    narrator = TimelineNarrator(rng, home, away, expected, configuration, conditions)
    outcome = play_core(
        rng, home.strength, away.strength, model, narrator, expected=expected
    )
    stats = narrator.stats()
    home_goals, away_goals = outcome.home_goals, outcome.away_goals

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
        probabilities=None,
        events=tuple(narrator.events),
        stats=stats,
        home_xg=outcome.home.xg,
        away_xg=outcome.away.xg,
    )
