from __future__ import annotations

import dataclasses
import itertools
import random
from collections import Counter

import pytest

from betng_simulation.engine import (
    NEUTRAL_CONDITIONS,
    PROGRESSIVE_MODEL_VERSION,
    ModelConfiguration,
    RateModel,
    TeamState,
    match_conditions,
    play_core,
    simulate,
)
from betng_simulation.engine.progressive import (
    LEADING,
    LEVEL,
    TRAILING_BY_MORE,
    TRAILING_BY_ONE,
    Narrator,
    game_state_factor,
    stoppage_minutes,
)
from betng_simulation.utils import build_configuration

from .conftest import AWAY_TEAM, HOME_TEAM, STRONG, WEAK

CONFIGURATION = ModelConfiguration()
MODEL = RateModel.build(CONFIGURATION)
MATCH_IDS = [f"99999999-9999-4999-8999-{index:012d}" for index in range(200)]


def team(**changes: float) -> TeamState:
    state = MODEL.new_team(1.35, STRONG)
    for name, value in changes.items():
        setattr(state, name, value)
    return state


def rate(attacking: TeamState, defending: TeamState, minute: int = 60) -> float:
    return MODEL.goal_rate(attacking, defending, minute, step=minute)


class TestDeterminism:
    def test_the_same_seed_replays_the_same_timeline(self) -> None:
        for match_id in MATCH_IDS[:20]:
            first = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
            second = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)

            assert first == second
            assert first.result.model_version == PROGRESSIVE_MODEL_VERSION

    def test_the_core_is_a_function_of_its_prng(self) -> None:
        def outcome(seed: int) -> tuple[int, int, int, int]:
            core = play_core(random.Random(seed), STRONG, WEAK, MODEL)
            return (core.home_goals, core.away_goals, core.home.reds, core.away.reds)

        assert [outcome(seed) for seed in range(50)] == [
            outcome(seed) for seed in range(50)
        ]


class TestGameState:
    def test_state_classes_order_the_scoring_rate(self) -> None:
        minute = 80
        level = game_state_factor(LEVEL, minute, CONFIGURATION)

        assert game_state_factor(TRAILING_BY_ONE, minute, CONFIGURATION) > level
        assert game_state_factor(TRAILING_BY_MORE, minute, CONFIGURATION) > level
        assert game_state_factor(LEADING, minute, CONFIGURATION) < level

    def test_game_state_matters_more_as_time_runs_out(self) -> None:
        early = game_state_factor(TRAILING_BY_MORE, 10, CONFIGURATION)
        late = game_state_factor(TRAILING_BY_MORE, 70, CONFIGURATION)

        assert 1.0 < early < late

    def test_late_urgency_applies_to_a_one_goal_deficit(self) -> None:
        before = game_state_factor(
            TRAILING_BY_ONE, CONFIGURATION.late_urgency_minute - 1, CONFIGURATION
        )
        after = game_state_factor(
            TRAILING_BY_ONE, CONFIGURATION.late_urgency_minute, CONFIGURATION
        )

        assert after / before > CONFIGURATION.late_urgency_factor * 0.99

    def test_a_trailing_side_scores_faster_and_a_leader_sits_back(self) -> None:
        level = rate(team(), team())
        trailing = rate(team(), team(goals=1))
        leading = rate(team(goals=1), team())

        assert trailing > level
        assert leading < trailing

    def test_a_leader_scores_less_when_it_sits_back_without_a_counter(self) -> None:
        configuration = dataclasses.replace(CONFIGURATION, counter_attack_factor=1.0)
        model = RateModel.build(configuration)
        leader = model.new_team(1.35, STRONG)
        leader.goals = 1
        chaser = model.new_team(1.35, STRONG)

        assert model.goal_rate(leader, chaser, 80, 80) < model.goal_rate(
            model.new_team(1.35, STRONG), chaser, 80, 80
        )


class TestRedCards:
    def test_a_red_card_cuts_the_attack_and_opens_the_defence(self) -> None:
        rng = random.Random(7)
        reduced = team()
        opponent = team()
        attack_before = rate(reduced, opponent)
        concede_before = rate(opponent, reduced)

        from betng_simulation.engine.progressive import _Match

        match = _Match(rng, MODEL, reduced, opponent, None)
        match._send_off(reduced, 3)

        assert rate(reduced, opponent) < attack_before
        assert rate(opponent, reduced) > concede_before
        low = 1 - CONFIGURATION.red_card_attack_penalty_max
        high = 1 - CONFIGURATION.red_card_attack_penalty_min
        assert low <= rate(reduced, opponent) / attack_before <= high

    def test_red_cards_shift_goals_away_from_the_reduced_side(self) -> None:
        configuration = dataclasses.replace(
            CONFIGURATION,
            red_card_probability=1.0,
            yellow_cards_per_team=0.0,
            max_red_cards_per_team=1,
        )
        model = RateModel.build(configuration)
        rng = random.Random(11)
        with_red: list[float] = []
        without_red: list[float] = []

        for _ in range(3000):
            core = play_core(rng, STRONG, STRONG, model)
            share = core.home_goals - core.away_goals
            if core.home.reds and not core.away.reds:
                with_red.append(share)
            elif not core.home.reds and not core.away.reds:
                without_red.append(share)

        assert len(with_red) > 200
        assert len(without_red) > 50
        assert sum(with_red) / len(with_red) < sum(without_red) / len(without_red)


class TestMomentum:
    def test_scoring_gives_a_short_lived_boost(self) -> None:
        window = CONFIGURATION.momentum_minutes
        scorer = team(goals=1, momentum_until=60 + window)
        conceder = team(rattled_until=60 + window)
        calm = rate(team(goals=1), team())

        boosted = MODEL.goal_rate(scorer, conceder, 61, 61)
        fading = MODEL.goal_rate(scorer, conceder, 60 + window, 60 + window)
        over = MODEL.goal_rate(scorer, conceder, 61 + window, 61 + window)

        assert boosted > fading > over
        assert over == pytest.approx(
            MODEL.goal_rate(team(goals=1), team(), 61 + window, 61 + window)
        )
        assert calm < boosted


class TestFactors:
    def test_the_factors_are_off_by_default(self) -> None:
        assert not CONFIGURATION.weather_enabled
        assert not CONFIGURATION.fatigue_enabled
        assert CONFIGURATION.referee_variance == 0
        assert CONFIGURATION.referee_strictness == 1
        assert CONFIGURATION.pitch_quality == 1
        assert match_conditions(MATCH_IDS[0], CONFIGURATION) == NEUTRAL_CONDITIONS

    def test_weather_is_a_public_property_of_the_match(self) -> None:
        configuration = dataclasses.replace(CONFIGURATION, weather_enabled=True)
        weathers = Counter(
            match_conditions(match_id, configuration).weather for match_id in MATCH_IDS
        )

        assert weathers["CLEAR"] > 50
        assert len(weathers) >= 4
        assert match_conditions(MATCH_IDS[0], configuration) == match_conditions(
            MATCH_IDS[0], configuration
        )

    def test_adverse_weather_and_a_poor_pitch_lower_scoring(self) -> None:
        configuration = dataclasses.replace(
            CONFIGURATION, weather_enabled=True, weather_severity=1.0, pitch_quality=0.6
        )
        rainy = next(
            match_id
            for match_id in MATCH_IDS
            if match_conditions(match_id, configuration).weather == "HEAVY_RAIN"
        )
        conditions = match_conditions(rainy, configuration)

        assert conditions.goal_factor < 1.0
        assert conditions.card_factor > 1.0
        assert conditions.foul_factor > 1.0
        assert (
            "heavy rain"
            in simulate(rainy, HOME_TEAM, AWAY_TEAM, configuration)
            .events[0]
            .description
        )

    def test_a_strict_referee_shows_more_cards(self) -> None:
        def cards(strictness: float) -> int:
            configuration = dataclasses.replace(
                CONFIGURATION, referee_strictness=strictness
            )
            model = RateModel.build(
                configuration, match_conditions(None, configuration)
            )
            rng = random.Random(5)
            return sum(
                core.home.yellows + core.away.yellows
                for core in (play_core(rng, STRONG, WEAK, model) for _ in range(800))
            )

        assert cards(1.4) > cards(1.0) > cards(0.6)

    def test_referee_variance_spreads_strictness_across_matches(self) -> None:
        configuration = dataclasses.replace(CONFIGURATION, referee_variance=0.3)
        strictness = {
            round(match_conditions(match_id, configuration).referee_strictness, 3)
            for match_id in MATCH_IDS
        }

        assert len(strictness) > 100
        assert all(0.7 <= value <= 1.3 for value in strictness)

    def test_fatigue_raises_late_scoring_and_substitutes_relieve_it(self) -> None:
        configuration = dataclasses.replace(CONFIGURATION, fatigue_enabled=True)
        model = RateModel.build(configuration)
        attacker = model.new_team(1.35, STRONG)
        attacker.substitutions = 10
        tired = model.new_team(1.35, WEAK)
        refreshed = model.new_team(1.35, WEAK)
        refreshed.substitutions = 5

        early = model.goal_rate(attacker, tired, 50, 50)
        late = model.goal_rate(attacker, tired, 85, 85)
        relieved = model.goal_rate(attacker, refreshed, 85, 85)
        without = MODEL.goal_rate(
            MODEL.new_team(1.35, STRONG), MODEL.new_team(1.35, WEAK), 85, 85
        )

        assert model.fatigue_level(tired, 50) == 0
        assert late > relieved > without
        assert early == pytest.approx(
            MODEL.goal_rate(
                MODEL.new_team(1.35, STRONG), MODEL.new_team(1.35, WEAK), 50, 50
            )
        )

    def test_factor_parameters_are_validated(self) -> None:
        from betng_simulation.errors import InvalidConfigurationError

        for bad in (
            {"weatherSeverity": 2},
            {"pitchQuality": 0.1},
            {"refereeStrictness": 3},
            {"fatigueRate": 1},
            {"redCardAttackPenaltyMin": 0.5, "redCardAttackPenaltyMax": 0.2},
            {"pricingSimulations": 10},
        ):
            with pytest.raises(InvalidConfigurationError):
                build_configuration(2, PROGRESSIVE_MODEL_VERSION, bad)

        with pytest.raises(InvalidConfigurationError):
            build_configuration(2, "made-up-9.9", {})


class _Probe(Narrator):
    def __init__(self, model: RateModel) -> None:
        self.model = model
        self.step = 0
        self.pairs: list[tuple[float, float, float, float]] = []

    def minute(
        self,
        minute: int,
        added: int,
        home: TeamState,
        away: TeamState,
        home_rate: float,
        away_rate: float,
    ) -> None:
        self.step += 1
        self.pairs.append(
            (
                home_rate,
                away_rate,
                self.model.goal_rate(home, away, minute, self.step),
                self.model.goal_rate(away, home, minute, self.step),
            )
        )


class TestCoreAndNarration:
    @pytest.mark.parametrize(
        "configuration",
        [
            CONFIGURATION,
            dataclasses.replace(CONFIGURATION, fatigue_enabled=True),
            dataclasses.replace(CONFIGURATION, momentum_minutes=0),
        ],
        ids=["default", "fatigue", "no-momentum"],
    )
    def test_the_fast_path_rates_equal_the_rate_model(
        self, configuration: ModelConfiguration
    ) -> None:
        model = RateModel.build(configuration)
        rng = random.Random(3)

        for _ in range(200):
            probe = _Probe(model)
            core = play_core(rng, STRONG, WEAK, model, probe)

            assert len(probe.pairs) == (
                90 + core.first_half_added + core.second_half_added
            )
            for home_rate, away_rate, expected_home, expected_away in probe.pairs:
                assert home_rate == pytest.approx(expected_home, rel=1e-12)
                assert away_rate == pytest.approx(expected_away, rel=1e-12)

    def test_the_narration_never_feeds_a_rate(self) -> None:
        source = __import__("inspect").getsource(
            __import__("betng_simulation.engine.timeline", fromlist=["x"])
        )

        for forbidden in (".goal_scale", ".concession", ".momentum_until", ".goals +="):
            assert forbidden not in source


class TestTimeline:
    @pytest.mark.parametrize("match_id", MATCH_IDS)
    def test_stoppage_time_is_derived_and_clamped_to_the_half(
        self, match_id: str
    ) -> None:
        output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
        events = output.events
        half_time = next(e for e in events if e.type == "HALF_TIME")
        first_half = [e for e in events if e.sequence < half_time.sequence]
        second_half = [e for e in events if e.sequence > half_time.sequence]

        assert all(e.minute <= 45 for e in first_half)
        assert all(46 <= e.minute <= 90 for e in second_half)
        for event in events:
            if event.description[:3] in ("45+", "90+"):
                assert event.minute == int(event.description[:2])
        assert all(
            earlier.minute <= later.minute
            for earlier, later in itertools.pairwise(events)
        )

    def test_stoppage_grows_with_stoppages(self) -> None:
        quiet = stoppage_minutes(0, 0, 0, 2.0, 8, CONFIGURATION)
        busy = stoppage_minutes(3, 4, 5, 2.0, 8, CONFIGURATION)

        assert quiet == 2
        assert quiet < busy <= 8

    def test_a_second_yellow_sends_the_player_off(self) -> None:
        configuration = dataclasses.replace(
            CONFIGURATION, yellow_cards_per_team=12.0, max_yellow_cards_per_team=9
        )
        seen_second_yellow = False

        for match_id in MATCH_IDS[:60]:
            output = simulate(match_id, HOME_TEAM, AWAY_TEAM, configuration)
            booked: set[tuple[str | None, str | None]] = set()
            for event in output.events:
                key = (event.side, event.player)
                if event.type == "YELLOW_CARD":
                    if key in booked:
                        following = output.events[event.sequence]
                        assert following.type == "RED_CARD"
                        assert (following.side, following.player) == key
                        assert "second yellow" in following.description
                        seen_second_yellow = True
                    booked.add(key)
                if event.type == "SUBSTITUTION":
                    booked.discard((event.side, event.secondary_player))

        assert seen_second_yellow

    def test_xg_is_the_sum_of_the_minute_intensities(self) -> None:
        output = simulate(MATCH_IDS[0], HOME_TEAM, AWAY_TEAM, CONFIGURATION)

        assert 0.5 < output.home_xg < 5
        assert 0.1 < output.away_xg < 3
        assert output.home_xg > output.away_xg

    def test_goal_levels_match_the_pre_match_expectation(self) -> None:
        from betng_simulation.engine import expected_goals

        rng = random.Random(21)
        home_xg, away_xg = expected_goals(STRONG, WEAK, CONFIGURATION)
        runs = 4000
        cores = [play_core(rng, STRONG, WEAK, MODEL) for _ in range(runs)]

        assert sum(c.home_goals for c in cores) / runs == pytest.approx(
            home_xg, rel=0.08
        )
        assert sum(c.away_goals for c in cores) / runs == pytest.approx(
            away_xg, rel=0.12
        )
