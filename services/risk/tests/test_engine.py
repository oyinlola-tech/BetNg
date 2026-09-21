from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from betng_risk.engine import (
    EngineDecision,
    ExposureBook,
    Limits,
    MarketBook,
    SelectionState,
    SlipLeg,
    decide,
    largest_stake,
    odds_fraction,
    potential_payout,
    total_odds,
    utilisation_status,
)

NOW = datetime(2026, 9, 21, 12, 0, tzinfo=UTC)

LIMITS = Limits(
    version=1,
    min_stake=5_000,
    max_stake_per_bet=50_000_000,
    max_payout_per_bet=2_000_000_000,
    max_liability_per_selection=1_500_000_000,
    max_liability_per_market=3_000_000_000,
    max_liability_per_match=6_000_000_000,
)

MATCH, MARKET, HOME, DRAW, AWAY = (
    "match-1",
    "market-1",
    "sel-home",
    "sel-draw",
    "sel-away",
)
MATCH_2, MARKET_2, OVER = "match-2", "market-2", "sel-over"
MARKET_BTTS, BTTS_YES = "market-btts", "sel-btts-yes"


def leg(
    selection_id: str = HOME,
    odds: str = "2.00",
    market_id: str = MARKET,
    match_id: str = MATCH,
) -> SlipLeg:
    return SlipLeg(match_id, market_id, selection_id, Decimal(odds))


def state(
    selection_id: str = HOME,
    *,
    market_id: str = MARKET,
    match_id: str = MATCH,
    market_status: str = "OPEN",
    lifecycle: str | None = "BETTING_OPEN",
    closes_at: datetime | None = NOW + timedelta(minutes=5),
    frozen: bool = False,
) -> SelectionState:
    return SelectionState(
        selection_id=selection_id,
        market_id=market_id,
        match_id=match_id,
        market_status=market_status,
        match_lifecycle=lifecycle,
        betting_closes_at=closes_at,
        frozen=frozen,
    )


def run(
    stake: int,
    legs: list[SlipLeg] | None = None,
    *,
    limits: Limits = LIMITS,
    states: list[SelectionState] | None = None,
    book: ExposureBook | None = None,
) -> EngineDecision:
    slip = legs or [leg()]
    known = states if states is not None else [state()]

    return decide(
        stake=stake,
        legs=slip,
        limits=limits,
        states={entry.selection_id: entry for entry in known},
        book=book or ExposureBook(),
        now=NOW,
    )


def with_limits(**overrides: int) -> Limits:
    return Limits(**{**LIMITS.__dict__, **overrides})


REJECT_CLOSED = EngineDecision("REJECT", "MARKET_CLOSED", 0)


class TestMarketState:
    @pytest.mark.parametrize(
        "lifecycle",
        [
            "FIXTURE_CREATED",
            "ODDS_PUBLISHED",
            "BETTING_CLOSED",
            "SIMULATION_STARTED",
            "RESULT_GENERATED",
            "MATCH_FINISHED",
            "VOIDED",
        ],
    )
    def test_rejects_a_match_that_is_not_open_for_betting(self, lifecycle: str) -> None:
        assert run(10_000, states=[state(lifecycle=lifecycle)]) == REJECT_CLOSED

    @pytest.mark.parametrize("lifecycle", ["BETTING_OPEN", "BETTING_ACTIVE"])
    def test_accepts_both_open_lifecycles(self, lifecycle: str) -> None:
        assert run(10_000, states=[state(lifecycle=lifecycle)]).decision == "ACCEPT"

    def test_rejects_at_the_closing_instant(self) -> None:
        assert run(10_000, states=[state(closes_at=NOW)]) == REJECT_CLOSED

    def test_rejects_after_the_closing_instant(self) -> None:
        closed = state(closes_at=NOW - timedelta(seconds=1))
        assert run(10_000, states=[closed]) == REJECT_CLOSED

    def test_rejects_a_frozen_match(self) -> None:
        assert run(10_000, states=[state(frozen=True)]) == REJECT_CLOSED

    def test_rejects_a_suspended_market(self) -> None:
        decision = run(10_000, states=[state(market_status="SUSPENDED")])
        assert decision == EngineDecision("REJECT", "MARKET_SUSPENDED", 0)

    @pytest.mark.parametrize("status", ["CLOSED", "SETTLED", "VOID"])
    def test_rejects_a_market_that_is_not_open(self, status: str) -> None:
        assert run(10_000, states=[state(market_status=status)]) == REJECT_CLOSED

    def test_a_closed_match_outranks_a_suspended_market(self) -> None:
        decision = run(
            10_000,
            states=[state(lifecycle="BETTING_CLOSED", market_status="SUSPENDED")],
        )
        assert decision == REJECT_CLOSED

    def test_one_closed_leg_rejects_the_whole_slip(self) -> None:
        decision = run(
            10_000,
            [leg(), leg(OVER, "1.90", MARKET_2, MATCH_2)],
            states=[
                state(),
                state(
                    OVER,
                    market_id=MARKET_2,
                    match_id=MATCH_2,
                    lifecycle="BETTING_CLOSED",
                ),
            ],
        )
        assert decision == REJECT_CLOSED


INVALID = EngineDecision("REJECT", "INVALID_SELECTION", 0)


class TestInvalidSelection:
    def test_rejects_an_unknown_selection(self) -> None:
        assert run(10_000, states=[]) == INVALID

    def test_rejects_a_selection_from_another_market(self) -> None:
        assert run(10_000, states=[state(market_id="other-market")]) == INVALID

    def test_rejects_a_selection_from_another_match(self) -> None:
        assert run(10_000, states=[state(match_id="other-match")]) == INVALID

    def test_rejects_a_market_whose_match_does_not_exist(self) -> None:
        assert run(10_000, states=[state(lifecycle=None, closes_at=None)]) == INVALID

    def test_rejects_the_same_selection_twice(self) -> None:
        assert run(10_000, [leg(), leg()]) == INVALID

    def test_one_unknown_leg_rejects_a_multi_leg_slip(self) -> None:
        assert run(10_000, [leg(), leg(OVER, "1.90", MARKET_2, MATCH_2)]) == INVALID


class TestStakeBounds:
    def test_rejects_a_stake_below_the_minimum(self) -> None:
        assert run(4_999) == EngineDecision("REJECT", "STAKE_BELOW_MINIMUM", 0)

    def test_accepts_the_minimum_stake(self) -> None:
        assert run(5_000).decision == "ACCEPT"

    def test_accept_reports_the_largest_stake_allowed(self) -> None:
        assert run(10_000) == EngineDecision("ACCEPT", "WITHIN_LIMIT", 50_000_000)

    def test_accepts_exactly_the_maximum_stake(self) -> None:
        assert run(50_000_000).decision == "ACCEPT"

    def test_limits_a_stake_above_the_per_bet_maximum(self) -> None:
        assert run(50_000_001) == EngineDecision("LIMIT", "STAKE_LIMIT", 50_000_000)


#: Liability limits far enough away that only the payout cap can bind.
ROOMY = with_limits(
    max_liability_per_selection=10**13,
    max_liability_per_market=10**13,
    max_liability_per_match=10**13,
)


class TestPayoutLimit:
    def test_limits_to_the_payout_cap_divided_by_the_odds(self) -> None:
        # 2,000,000,000 / 50.00 = 40,000,000, below the 50,000,000 stake cap.
        decision = run(45_000_000, [leg(odds="50.00")], limits=ROOMY)
        assert decision == EngineDecision("LIMIT", "PAYOUT_LIMIT", 40_000_000)

    def test_the_cap_is_floored(self) -> None:
        limits = with_limits(max_payout_per_bet=1_000_000)
        decision = run(900_000, [leg(odds="3.00")], limits=limits)

        assert decision == EngineDecision("LIMIT", "PAYOUT_LIMIT", 333_333)
        assert potential_payout(333_333, 300, 100) <= 1_000_000

    def test_multi_leg_odds_multiply(self) -> None:
        slip = [leg(odds="10.00"), leg(OVER, "10.00", MARKET_2, MATCH_2)]
        states = [state(), state(OVER, market_id=MARKET_2, match_id=MATCH_2)]

        decision = run(30_000_000, slip, limits=ROOMY, states=states)
        assert decision == EngineDecision("LIMIT", "PAYOUT_LIMIT", 20_000_000)

    def test_rejects_when_the_payout_cap_leaves_less_than_the_minimum(self) -> None:
        slip = [
            leg(odds="1000.00"),
            leg(OVER, "1000.00", MARKET_2, MATCH_2),
        ]
        states = [state(), state(OVER, market_id=MARKET_2, match_id=MATCH_2)]

        # 2,000,000,000 / 1,000,000 = 2,000 kobo, under the 5,000 minimum.
        assert run(10_000, slip, limits=ROOMY, states=states) == EngineDecision(
            "REJECT", "PAYOUT_LIMIT", 0
        )

    def test_exposure_binds_before_the_payout_cap_under_the_default_limits(
        self,
    ) -> None:
        # 30,612,244 at 50.00 carries 1,499,999,956 of liability.
        decision = run(45_000_000, [leg(odds="50.00")])
        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 30_612_244)


def home_book(stake: int, payout: int) -> ExposureBook:
    return ExposureBook(
        selection_liability={HOME: payout - stake},
        markets={MARKET: MarketBook(MARKET, MATCH, stake, {HOME: payout})},
    )


class TestExposureLimit:
    def test_selection_liability_limits_the_stake(self) -> None:
        limits = with_limits(max_liability_per_selection=1_000_000)
        # Liability so far 400,000; at 2.00 each kobo staked adds one of liability.
        decision = run(700_000, limits=limits, book=home_book(400_000, 800_000))

        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 600_000)

    def test_the_limited_stake_is_the_largest_that_fits(self) -> None:
        limits = with_limits(max_liability_per_selection=1_000_000)
        book = home_book(400_000, 1_140_000)
        decision = run(900_000, [leg(odds="2.85")], limits=limits, book=book)

        assert decision.decision == "LIMIT"
        added = potential_payout(decision.max_stake, 285, 100) - decision.max_stake
        beyond = potential_payout(decision.max_stake + 1, 285, 100) - (
            decision.max_stake + 1
        )
        assert 740_000 + added <= 1_000_000
        assert 740_000 + beyond > 1_000_000

    def test_accepts_a_stake_that_exactly_reaches_the_limit(self) -> None:
        limits = with_limits(max_liability_per_selection=1_000_000)
        decision = run(600_000, limits=limits, book=home_book(400_000, 800_000))

        assert decision == EngineDecision("ACCEPT", "WITHIN_LIMIT", 600_000)

    def test_rejects_when_the_selection_is_at_its_limit(self) -> None:
        limits = with_limits(max_liability_per_selection=400_000)
        decision = run(10_000, limits=limits, book=home_book(400_000, 800_000))

        assert decision == EngineDecision("REJECT", "EXPOSURE_LIMIT", 0)

    def test_rejects_when_the_room_left_is_below_the_minimum_stake(self) -> None:
        limits = with_limits(max_liability_per_selection=404_000)
        decision = run(10_000, limits=limits, book=home_book(400_000, 800_000))

        assert decision == EngineDecision("REJECT", "EXPOSURE_LIMIT", 0)

    def test_market_worst_case_limits_the_stake(self) -> None:
        limits = with_limits(max_liability_per_market=500_000)
        # Market stake 1,000,000: 300,000 on HOME paying 1,200,000 (net 200,000).
        book = ExposureBook(
            selection_liability={HOME: 900_000, AWAY: 700_000},
            markets={
                MARKET: MarketBook(
                    MARKET, MATCH, 1_000_000, {HOME: 1_200_000, AWAY: 1_400_000}
                )
            },
        )
        decision = run(400_000, [leg(odds="4.00")], limits=limits, book=book)

        # Net on HOME may grow by 300,000; at 4.00 a stake adds three times itself.
        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 100_000)

    def test_stakes_on_other_selections_offset_the_market_worst_case(self) -> None:
        limits = with_limits(max_liability_per_market=500_000)
        book = ExposureBook(
            selection_liability={AWAY: 2_000_000},
            markets={MARKET: MarketBook(MARKET, MATCH, 1_000_000, {AWAY: 3_000_000})},
        )
        # Nothing is on HOME, so its net starts at minus the market stake.
        decision = run(1_500_000, limits=limits, book=book)

        assert decision == EngineDecision("ACCEPT", "WITHIN_LIMIT", 1_500_000)

    def test_match_worst_case_sums_its_markets(self) -> None:
        limits = with_limits(max_liability_per_match=1_000_000)
        book = ExposureBook(
            selection_liability={BTTS_YES: 600_000},
            markets={
                MARKET_BTTS: MarketBook(
                    MARKET_BTTS, MATCH, 600_000, {BTTS_YES: 1_200_000}
                )
            },
        )
        # The other market already carries 600,000; this one may add 400,000.
        decision = run(500_000, limits=limits, book=book)

        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 400_000)

    def test_a_market_in_profit_does_not_offset_another_market(self) -> None:
        limits = with_limits(max_liability_per_match=1_000_000)
        book = ExposureBook(
            markets={
                MARKET_BTTS: MarketBook(
                    MARKET_BTTS, MATCH, 900_000, {BTTS_YES: 100_000}
                )
            }
        )
        decision = run(1_200_000, limits=limits, book=book)

        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 1_000_000)

    def test_a_match_over_its_limit_takes_no_stake_that_raises_it(self) -> None:
        limits = with_limits(max_liability_per_match=500_000)
        book = ExposureBook(
            markets={
                MARKET_BTTS: MarketBook(
                    MARKET_BTTS, MATCH, 100_000, {BTTS_YES: 900_000}
                )
            }
        )

        assert run(10_000, limits=limits, book=book) == EngineDecision(
            "REJECT", "EXPOSURE_LIMIT", 0
        )

    def test_other_matches_do_not_count_towards_a_match(self) -> None:
        limits = with_limits(max_liability_per_match=1_000_000)
        book = ExposureBook(
            markets={
                MARKET_2: MarketBook(MARKET_2, MATCH_2, 100_000, {OVER: 5_000_000})
            }
        )

        assert run(1_000_000, limits=limits, book=book).decision == "ACCEPT"

    def test_the_tightest_leg_of_a_multi_leg_slip_binds(self) -> None:
        limits = with_limits(max_liability_per_selection=1_000_000)
        slip = [leg(odds="2.00"), leg(OVER, "1.50", MARKET_2, MATCH_2)]
        states = [state(), state(OVER, market_id=MARKET_2, match_id=MATCH_2)]
        book = ExposureBook(
            selection_liability={HOME: 100_000, OVER: 700_000},
            markets={
                MARKET: MarketBook(MARKET, MATCH, 100_000, {HOME: 200_000}),
                MARKET_2: MarketBook(MARKET_2, MATCH_2, 1_400_000, {OVER: 2_100_000}),
            },
        )
        # Total odds 3.00 add twice the stake to each leg; OVER has 300,000 of room.
        decision = run(200_000, slip, limits=limits, states=states, book=book)

        assert decision == EngineDecision("LIMIT", "EXPOSURE_LIMIT", 150_000)


class TestArithmetic:
    def test_total_odds_is_an_exact_fraction(self) -> None:
        assert odds_fraction([Decimal("1.85"), Decimal("2.10")]) == (185 * 210, 10_000)

    def test_total_odds_rounds_down_to_two_places(self) -> None:
        assert total_odds(185 * 210, 10_000) == Decimal("3.88")

    def test_payout_is_floored(self) -> None:
        assert potential_payout(333, 185, 100) == 616

    def test_largest_stake_finds_the_boundary(self) -> None:
        assert largest_stake(lambda stake: stake <= 1_234, 10_000) == 1_234

    def test_largest_stake_is_zero_when_nothing_is_allowed(self) -> None:
        assert largest_stake(lambda stake: False, 10_000) == 0

    def test_largest_stake_is_the_upper_bound_when_everything_is_allowed(self) -> None:
        assert largest_stake(lambda stake: True, 10_000) == 10_000

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (0, "NORMAL"),
            (499, "NORMAL"),
            (500, "ELEVATED"),
            (850, "ELEVATED"),
            (851, "CRITICAL"),
            (-100, "NORMAL"),
        ],
    )
    def test_utilisation_thresholds(self, value: int, expected: str) -> None:
        assert utilisation_status([(value, 1_000)]) == expected

    def test_the_most_utilised_limit_sets_the_status(self) -> None:
        assert (
            utilisation_status([(10, 1_000), (900, 1_000), (600, 1_000)]) == "CRITICAL"
        )
