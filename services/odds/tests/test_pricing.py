from __future__ import annotations

from decimal import Decimal

import pytest

from betng_odds.pricing import (
    MARKET_TYPES,
    InvalidScoreMatrixError,
    PricedMarket,
    PricingConfiguration,
    derive_market_probabilities,
    overround,
    price_markets,
    price_selection,
)
from conftest import poisson_matrix

MARGINS = {
    "MATCH_RESULT": Decimal("0.07"),
    "DOUBLE_CHANCE": Decimal("0.05"),
    "OVER_UNDER": Decimal("0.06"),
    "BOTH_TEAMS_TO_SCORE": Decimal("0.04"),
    "GOAL_SPREAD": Decimal("0.08"),
    "CORRECT_SCORE": Decimal("0.15"),
}
CONFIGURATION = PricingConfiguration(
    version=1, margins=MARGINS, min_odds=Decimal("1.01"), max_odds=Decimal("500")
)
#: Two-decimal rounding moves a market's overround by a few thousandths.
ROUNDING_TOLERANCE = Decimal("0.006")


def priced(home_xg: float = 1.6, away_xg: float = 1.1) -> dict[str, PricedMarket]:
    markets = price_markets(
        derive_market_probabilities(poisson_matrix(home_xg, away_xg), "LIO", "TIG"),
        CONFIGURATION,
    )

    return {
        market.type if market.line is None else f"{market.type}:{market.line}": market
        for market in markets
    }


def total_probability(market: PricedMarket) -> Decimal:
    return sum((s.probability for s in market.selections), Decimal(0))


class TestCatalogue:
    def test_every_contract_market_and_code_is_present(self) -> None:
        markets = priced()
        correct_scores = [f"CS_{h}_{a}" for h in range(4) for a in range(4)]

        assert {key: [s.code for s in m.selections] for key, m in markets.items()} == {
            "MATCH_RESULT": ["HOME", "DRAW", "AWAY"],
            "DOUBLE_CHANCE": ["HOME_DRAW", "HOME_AWAY", "DRAW_AWAY"],
            "OVER_UNDER:1.5": ["OVER_1_5", "UNDER_1_5"],
            "OVER_UNDER:2.5": ["OVER_2_5", "UNDER_2_5"],
            "OVER_UNDER:3.5": ["OVER_3_5", "UNDER_3_5"],
            "BOTH_TEAMS_TO_SCORE": ["YES", "NO"],
            "GOAL_SPREAD:-1.5": ["HOME_MINUS_1_5", "AWAY_PLUS_1_5"],
            "CORRECT_SCORE": [*correct_scores, "CS_OTHER"],
        }
        assert {m.type for m in markets.values()} == set(MARKET_TYPES)

    def test_labels_are_the_ones_the_frontends_render(self) -> None:
        markets = priced()

        def labels(key: str) -> list[str]:
            return [s.label for s in markets[key].selections]

        assert labels("MATCH_RESULT") == ["LIO", "Draw", "TIG"]
        assert labels("DOUBLE_CHANCE") == ["LIO or Draw", "LIO or TIG", "Draw or TIG"]
        assert labels("OVER_UNDER:2.5") == ["Over 2.5", "Under 2.5"]
        assert labels("BOTH_TEAMS_TO_SCORE") == ["Yes", "No"]
        assert labels("GOAL_SPREAD:-1.5") == ["LIO -1.5", "TIG +1.5"]
        assert labels("CORRECT_SCORE")[1] == "0 \N{EN DASH} 1"
        assert labels("CORRECT_SCORE")[-1] == "Any other score"
        assert markets["OVER_UNDER:2.5"].name == "Total Goals 2.5"


class TestProbabilities:
    def test_each_market_sums_to_one_and_double_chance_to_two(self) -> None:
        for key, market in priced().items():
            expected = Decimal(2) if key == "DOUBLE_CHANCE" else Decimal(1)

            assert abs(total_probability(market) - expected) < Decimal("0.00002"), key

    def test_over_and_under_are_complements(self) -> None:
        markets = priced()

        for line in ("1.5", "2.5", "3.5"):
            over, under = markets[f"OVER_UNDER:{line}"].selections

            assert abs(over.probability + under.probability - 1) < Decimal("0.000002")

        assert (
            markets["OVER_UNDER:1.5"].selections[0].probability
            > markets["OVER_UNDER:2.5"].selections[0].probability
            > markets["OVER_UNDER:3.5"].selections[0].probability
        )

    def test_correct_score_cells_and_other_sum_to_one(self) -> None:
        market = priced()["CORRECT_SCORE"]

        assert len(market.selections) == 17
        assert abs(total_probability(market) - 1) < Decimal("0.00002")
        assert market.selections[-1].code == "CS_OTHER"
        assert market.selections[-1].probability > 0

    def test_a_truncated_matrix_is_renormalised(self) -> None:
        matrix = [[cell * 0.9 for cell in row] for row in poisson_matrix(1.6, 1.1)]
        result = derive_market_probabilities(matrix, "LIO", "TIG")[0]

        assert abs(sum(s.probability for s in result.selections) - 1) < Decimal(
            "0.00001"
        )

    @pytest.mark.parametrize(
        "matrix",
        [[], [[]], [[0.5, 0.5], [0.1]], [[0.0, 0.0], [0.0, 0.0]], [[-0.1, 1.1]]],
    )
    def test_an_unusable_matrix_is_refused(self, matrix: list[list[float]]) -> None:
        with pytest.raises(InvalidScoreMatrixError):
            derive_market_probabilities(matrix, "LIO", "TIG")


class TestMargin:
    def test_overround_equals_the_configured_margin_within_rounding(self) -> None:
        for key, market in priced().items():
            measured = overround(
                [s.odds for s in market.selections],
                [s.probability for s in market.selections],
            )

            assert abs(measured - MARGINS[market.type]) < ROUNDING_TOLERANCE, key

    def test_every_price_is_bounded_and_has_two_decimals(self) -> None:
        for home_xg, away_xg in ((1.6, 1.1), (4.5, 0.2), (0.15, 0.15)):
            for market in priced(home_xg, away_xg).values():
                for selection in market.selections:
                    assert Decimal("1.01") <= selection.odds <= Decimal("500")
                    assert selection.odds == selection.odds.quantize(Decimal("0.01"))

    def test_bounds_come_from_the_configuration(self) -> None:
        narrow = PricingConfiguration(1, MARGINS, Decimal("1.50"), Decimal("4.00"))
        markets = price_markets(
            derive_market_probabilities(poisson_matrix(4.5, 0.2), "LIO", "TIG"), narrow
        )
        prices = [s.odds for market in markets for s in market.selections]

        assert min(prices) == Decimal("1.50")
        assert max(prices) == Decimal("4.00")

    def test_an_impossible_selection_takes_the_maximum_price(self) -> None:
        assert price_selection(
            Decimal(0), Decimal("0.07"), Decimal("1.01"), Decimal("500")
        ) == Decimal("500")

    def test_the_formula(self) -> None:
        # 1 / (0.5 * 1.07) = 1.8691...
        assert price_selection(
            Decimal("0.5"), Decimal("0.07"), Decimal("1.01"), Decimal("500")
        ) == Decimal("1.87")

    def test_a_stronger_home_team_has_a_shorter_home_price(self) -> None:
        even = priced(1.3, 1.3)["MATCH_RESULT"].selections
        strong = priced(2.4, 0.8)["MATCH_RESULT"].selections

        assert strong[0].odds < even[0].odds
        assert strong[2].odds > even[2].odds


class TestDeterminism:
    def test_the_same_inputs_give_the_same_prices(self) -> None:
        assert priced() == priced()
