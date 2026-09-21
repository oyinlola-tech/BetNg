from __future__ import annotations

import dataclasses

import pytest

from betng_simulation.engine import (
    ModelConfiguration,
    SimulationTeam,
    TeamStrength,
    calculate_probabilities,
    create_prng,
    derive_seed,
    derive_winner,
    expected_goals,
    outcome_probabilities,
    sample_score,
    simulate,
    squad_for,
)
from betng_simulation.engine.events import generate_timeline

from .conftest import AWAY_TEAM, HOME_TEAM, STRONG, WEAK

CONFIGURATION = ModelConfiguration()
MATCH_ID = "44444444-4444-4444-8444-444444444444"
MATCH_IDS = [f"55555555-5555-4555-8555-{index:012d}" for index in range(300)]
CONTRACT_EVENT_TYPES = {
    "KICK_OFF",
    "GOAL",
    "YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "CORNER",
    "HALF_TIME",
    "SECOND_HALF",
    "FULL_TIME",
}


class TestDeterminism:
    def test_same_inputs_replay_the_same_result_and_timeline(self) -> None:
        first = simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
        second = simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION)

        assert first.result == second.result
        assert first.events == second.events
        assert first.stats == second.stats

    def test_the_seed_is_the_documented_hash(self) -> None:
        import hashlib

        expected = hashlib.sha256(f"{MATCH_ID}:poisson-1.0:1".encode()).hexdigest()

        assert derive_seed(MATCH_ID, "poisson-1.0", 1) == expected
        assert simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION).result.seed == (
            expected
        )

    def test_results_vary_across_matches(self) -> None:
        scores = {
            (output.result.home_goals, output.result.away_goals)
            for output in (
                simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
                for match_id in MATCH_IDS
            )
        }

        assert len(scores) > 8

    def test_a_new_configuration_version_changes_the_seed(self) -> None:
        other = dataclasses.replace(CONFIGURATION, version=2)

        assert (
            simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, other).result.seed
            != simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION).result.seed
        )

    def test_squads_are_stable_and_unique_per_team(self) -> None:
        squad = squad_for(HOME_TEAM.team_id)
        names = [player.name for player in (*squad.starters, *squad.bench)]

        assert squad == squad_for(HOME_TEAM.team_id)
        assert squad != squad_for(AWAY_TEAM.team_id)
        assert len(squad.starters) == 11
        assert len(set(names)) == len(names)


class TestConsistency:
    @pytest.mark.parametrize("match_id", MATCH_IDS)
    def test_timeline_agrees_with_the_score(self, match_id: str) -> None:
        output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
        result, events = output.result, output.events

        assert {event.type for event in events} <= CONTRACT_EVENT_TYPES
        assert [event.sequence for event in events] == list(range(1, len(events) + 1))
        assert all(
            earlier.minute <= later.minute
            for earlier, later in zip(events, events[1:], strict=False)
        )

        assert (events[0].type, events[0].minute) == ("KICK_OFF", 0)
        assert (events[-1].type, events[-1].minute) == ("FULL_TIME", 90)
        assert [(e.type, e.minute) for e in events if e.type == "HALF_TIME"] == [
            ("HALF_TIME", 45)
        ]
        assert [(e.type, e.minute) for e in events if e.type == "SECOND_HALF"] == [
            ("SECOND_HALF", 46)
        ]

        home = away = 0
        for event in events:
            if event.type == "GOAL":
                assert 1 <= event.minute <= 90
                assert event.player is not None
                assert event.player != event.secondary_player
                home += event.side == "HOME"
                away += event.side == "AWAY"
            assert (event.score_home, event.score_away) == (home, away)

        assert (home, away) == (result.home_goals, result.away_goals)
        assert (events[-1].score_home, events[-1].score_away) == (home, away)
        assert result.winner == derive_winner(home, away)
        assert result.winning_gap == abs(home - away)

    @pytest.mark.parametrize("match_id", MATCH_IDS)
    def test_stats_agree_with_the_timeline(self, match_id: str) -> None:
        output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)

        def count(event_type: str, side: str) -> int:
            return sum(
                1 for e in output.events if e.type == event_type and e.side == side
            )

        assert output.stats.home.possession + output.stats.away.possession == 100

        for side, stats, goals in (
            ("HOME", output.stats.home, output.result.home_goals),
            ("AWAY", output.stats.away, output.result.away_goals),
        ):
            assert stats.corners == count("CORNER", side)
            assert stats.yellow_cards == count("YELLOW_CARD", side)
            assert stats.red_cards == count("RED_CARD", side)
            assert stats.shots_on_target >= goals
            assert stats.shots >= stats.shots_on_target
            assert stats.fouls >= stats.yellow_cards + stats.red_cards

            substitutions = [
                e for e in output.events if e.type == "SUBSTITUTION" and e.side == side
            ]
            assert len(substitutions) <= 5
            assert all(e.minute > 45 for e in substitutions)

    @pytest.mark.parametrize("match_id", MATCH_IDS[:100])
    def test_nobody_plays_after_leaving_the_pitch(self, match_id: str) -> None:
        output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
        gone: set[tuple[str | None, str]] = set()

        for event in output.events:
            if event.player is not None:
                assert (event.side, event.player) not in gone
            if event.type == "RED_CARD" and event.player is not None:
                gone.add((event.side, event.player))
            if event.type == "SUBSTITUTION" and event.secondary_player is not None:
                gone.add((event.side, event.secondary_player))

    @pytest.mark.parametrize(
        ("home_goals", "away_goals", "winner", "gap"),
        [(2, 0, "HOME", 2), (1, 1, "DRAW", 0), (0, 2, "AWAY", 2)],
    )
    def test_winner_and_gap_are_derived_from_the_score(
        self, home_goals: int, away_goals: int, winner: str, gap: int
    ) -> None:
        assert derive_winner(home_goals, away_goals) == winner
        assert abs(home_goals - away_goals) == gap

        events, _ = generate_timeline(
            create_prng(derive_seed(MATCH_ID, "poisson-1.0", 1)),
            HOME_TEAM,
            AWAY_TEAM,
            (home_goals, away_goals),
            (1.5, 1.0),
            CONFIGURATION,
        )
        goals = [event for event in events if event.type == "GOAL"]

        assert sum(1 for goal in goals if goal.side == "HOME") == home_goals
        assert sum(1 for goal in goals if goal.side == "AWAY") == away_goals


class TestScoreMatrix:
    @pytest.mark.parametrize("rho", [None, -0.08, 0.05])
    def test_cells_sum_to_one(self, rho: float | None) -> None:
        configuration = dataclasses.replace(CONFIGURATION, rho=rho)
        matrix = calculate_probabilities(STRONG, WEAK, configuration)

        assert len(matrix.cells) == configuration.max_goals + 1
        assert all(len(row) == configuration.max_goals + 1 for row in matrix.cells)
        assert all(0 <= cell <= 1 for row in matrix.cells for cell in row)
        assert sum(sum(row) for row in matrix.cells) == pytest.approx(1.0, abs=1e-9)
        assert sum(outcome_probabilities(matrix)) == pytest.approx(1.0, abs=1e-9)

    def test_a_stronger_home_side_is_likelier_to_win(self) -> None:
        strong_home, _, _ = outcome_probabilities(
            calculate_probabilities(STRONG, WEAK, CONFIGURATION)
        )
        weak_home, _, _ = outcome_probabilities(
            calculate_probabilities(WEAK, STRONG, CONFIGURATION)
        )
        even_home, _, even_away = outcome_probabilities(
            calculate_probabilities(STRONG, STRONG, CONFIGURATION)
        )

        assert strong_home > even_home > weak_home
        assert even_home > even_away

    def test_expected_goals_rise_with_attack(self) -> None:
        previous = 0.0

        for attack in range(0, 101, 10):
            home = dataclasses.replace(WEAK, attack=float(attack))
            home_xg, _ = expected_goals(home, WEAK, CONFIGURATION)
            assert home_xg > previous
            previous = home_xg

    def test_each_side_is_computed_from_its_own_attack(self) -> None:
        base_home, base_away = expected_goals(STRONG, WEAK, CONFIGURATION)
        better_away_attack = dataclasses.replace(WEAK, attack=90.0, finishing=90.0)
        home_xg, away_xg = expected_goals(STRONG, better_away_attack, CONFIGURATION)

        assert home_xg == base_home
        assert away_xg > base_away


class TestStatisticalSanity:
    def test_outcome_frequencies_track_the_matrix(self) -> None:
        runs = 4000
        matrix = calculate_probabilities(STRONG, WEAK, CONFIGURATION)
        expected = dict(
            zip(("HOME", "DRAW", "AWAY"), outcome_probabilities(matrix), strict=True)
        )
        observed = {"HOME": 0, "DRAW": 0, "AWAY": 0}

        for index in range(runs):
            match_id = f"66666666-6666-4666-8666-{index:012d}"
            observed[
                simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION).result.winner
            ] += 1

        for outcome, probability in expected.items():
            assert observed[outcome] / runs == pytest.approx(probability, abs=0.03)

    def test_the_result_is_sampled_from_the_priced_matrix(self) -> None:
        matrix = calculate_probabilities(STRONG, WEAK, CONFIGURATION)
        output = simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION)

        assert output.probabilities == matrix
        assert sample_score(create_prng(output.result.seed), matrix) == (
            output.result.home_goals,
            output.result.away_goals,
        )


def test_team_types_carry_no_bet_data() -> None:
    forbidden = {"stake", "bet", "user", "shop", "cashier", "exposure", "customer"}

    for model in (TeamStrength, SimulationTeam, ModelConfiguration):
        for field in dataclasses.fields(model):
            assert not set(field.name.lower().split("_")) & forbidden
