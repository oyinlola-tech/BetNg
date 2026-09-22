from __future__ import annotations

import dataclasses
import math

import pytest

from betng_simulation.engine import (
    ModelConfiguration,
    SimulationTeam,
    TeamStrength,
    brier_score,
    calibration_tolerance,
    derive_seed,
    expected_brier_score,
    log_loss,
    market_probabilities,
    monte_carlo_matrix,
    outcome_frequencies,
    pricing_seed,
    result_index,
    simulate,
)

from .conftest import AWAY_TEAM, HOME_TEAM, STRONG, WEAK

CONFIGURATION = ModelConfiguration()
SIMULATIONS = 6000
RUNS = 3000
EVEN = TeamStrength(65, 65, 65, 65, 65, 65, 65, 0, 50)
TOP_CORRECT_SCORES = 5

PAIRINGS = {
    "strong-v-weak": (HOME_TEAM, AWAY_TEAM),
    "even": (
        SimulationTeam(HOME_TEAM.team_id, "Even Home", "EVH", EVEN),
        SimulationTeam(AWAY_TEAM.team_id, "Even Away", "EVA", EVEN),
    ),
    "weak-v-strong": (
        SimulationTeam(HOME_TEAM.team_id, "Weak Home", "WKH", WEAK),
        SimulationTeam(AWAY_TEAM.team_id, "Strong Away", "STA", STRONG),
    ),
}
FACTORS = dataclasses.replace(
    CONFIGURATION,
    fatigue_enabled=True,
    referee_strictness=1.3,
    pitch_quality=0.7,
)


def _independent_scores(
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    prefix: str,
) -> list[tuple[int, int]]:
    return [
        (output.result.home_goals, output.result.away_goals)
        for output in (
            simulate(f"{prefix}-4000-8000-{index:012d}", home, away, configuration)
            for index in range(RUNS)
        )
    ]


def _check(
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    prefix: str,
) -> None:
    matrix = monte_carlo_matrix(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        home.strength,
        away.strength,
        configuration,
        SIMULATIONS,
    )
    priced = market_probabilities(matrix.cells)
    scores = _independent_scores(home, away, configuration, prefix)
    observed = outcome_frequencies(scores)
    top_cells = sorted(
        (name for name in priced if name.startswith("CS_")),
        key=lambda name: priced[name],
        reverse=True,
    )[:TOP_CORRECT_SCORES]
    checked = [
        "HOME",
        "DRAW",
        "AWAY",
        "OVER_1_5",
        "OVER_2_5",
        "OVER_3_5",
        "BTTS_YES",
        "HOME_MINUS_1_5",
        *top_cells,
    ]

    for name in checked:
        tolerance = calibration_tolerance(priced[name], SIMULATIONS, RUNS)
        assert abs(priced[name] - observed[name]) <= tolerance, (
            name,
            priced[name],
            observed[name],
            tolerance,
        )

    forecast = [priced["HOME"], priced["DRAW"], priced["AWAY"]]
    outcomes = [result_index(score) for score in scores]
    brier = brier_score([forecast] * RUNS, outcomes)
    assert brier == pytest.approx(expected_brier_score(forecast), abs=0.03)
    assert brier < brier_score([[1 / 3] * 3] * RUNS, outcomes)
    assert log_loss([forecast] * RUNS, outcomes) < math.log(3)


class TestMonteCarloCalibration:
    @pytest.mark.parametrize("pairing", list(PAIRINGS))
    def test_prices_match_independent_outcome_frequencies(self, pairing: str) -> None:
        home, away = PAIRINGS[pairing]
        prefix = {"strong-v-weak": "c1c1c1c1", "even": "c2c2c2c2"}.get(
            pairing, "c3c3c3c3"
        )

        _check(home, away, CONFIGURATION, f"{prefix}-c1c1")

    def test_calibration_holds_with_the_factors_switched_on(self) -> None:
        _check(HOME_TEAM, AWAY_TEAM, FACTORS, "c4c4c4c4-c4c4")


class TestPricingStream:
    def test_the_matrix_is_a_distribution(self) -> None:
        matrix = monte_carlo_matrix(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", STRONG, WEAK, CONFIGURATION, 2000
        )

        assert matrix.max_goals >= CONFIGURATION.max_goals
        assert len(matrix.cells) == matrix.max_goals + 1
        assert all(len(row) == matrix.max_goals + 1 for row in matrix.cells)
        assert math.fsum(cell for row in matrix.cells for cell in row) == (
            pytest.approx(1.0, abs=1e-12)
        )
        assert matrix.home_xg > matrix.away_xg

    def test_pricing_is_deterministic_per_match_and_version(self) -> None:
        match_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        first = monte_carlo_matrix(match_id, STRONG, WEAK, CONFIGURATION, 1500)

        assert first == monte_carlo_matrix(match_id, STRONG, WEAK, CONFIGURATION, 1500)
        assert first != monte_carlo_matrix(
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc", STRONG, WEAK, CONFIGURATION, 1500
        )
        assert first != monte_carlo_matrix(
            match_id,
            STRONG,
            WEAK,
            dataclasses.replace(CONFIGURATION, version=2),
            1500,
        )

    @pytest.mark.parametrize(
        "secret", [None, "a-test-seed-secret-of-at-least-32-chars"]
    )
    def test_the_pricing_seed_is_not_the_result_seed(self, secret: str | None) -> None:
        match_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        priced = pricing_seed(match_id, STRONG, WEAK, CONFIGURATION)
        result = derive_seed(
            match_id, CONFIGURATION.model_version, CONFIGURATION.version, secret
        )

        assert priced != result
        assert result not in priced
        assert len(priced) == 64

    def test_the_result_is_not_the_first_priced_simulation(self) -> None:
        agreements = 0
        for index in range(200):
            match_id = f"dddddddd-dddd-4ddd-8ddd-{index:012d}"
            output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
            first = monte_carlo_matrix(match_id, STRONG, WEAK, CONFIGURATION, 1)
            played = (output.result.home_goals, output.result.away_goals)
            agreements += first.cells[played[0]][played[1]] == 1.0

        assert agreements < 50


class TestScoringRules:
    def test_brier_and_log_loss_of_perfect_and_uniform_forecasts(self) -> None:
        outcomes = [0, 1, 2, 0]
        perfect = [[1.0 if i == o else 0.0 for i in range(3)] for o in outcomes]
        uniform = [[1 / 3] * 3] * len(outcomes)

        assert brier_score(perfect, outcomes) == 0
        assert brier_score(uniform, outcomes) == pytest.approx(2 / 3)
        assert log_loss(uniform, outcomes) == pytest.approx(math.log(3))
        assert log_loss(perfect, outcomes) == pytest.approx(0)

    def test_scoring_rules_reject_misaligned_input(self) -> None:
        with pytest.raises(ValueError):
            brier_score([[0.5, 0.5]], [0, 1])
        with pytest.raises(ValueError):
            log_loss([], [])
