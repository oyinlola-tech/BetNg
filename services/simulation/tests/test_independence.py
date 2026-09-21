"""Bets cannot reach the engine, so they cannot change a result."""

from __future__ import annotations

import inspect
from typing import Any

import pytest
from pydantic import ValidationError

from betng_simulation.dtos import (
    CalculateProbabilitiesRequest,
    RunMatchBody,
    RunMatchRequest,
    SimulationTeamDto,
    TeamStrengthDto,
)
from betng_simulation.engine import (
    ModelConfiguration,
    calculate_probabilities,
    simulate,
)
from betng_simulation.interfaces import Simulate
from betng_simulation.services.simulation.commands import RunMatchCommand

from .conftest import AWAY_TEAM, HOME_TEAM, run_match_payload

MATCH_ID = "77777777-7777-4777-8777-777777777777"
CONFIGURATION = ModelConfiguration()

SCENARIO_A = {"HOME": 1000, "AWAY": 100, "DRAW": 50}
SCENARIO_B = {"HOME": 100, "AWAY": 1000, "DRAW": 50}

FORBIDDEN_WORDS = (
    "stake",
    "bet",
    "user",
    "bettor",
    "customer",
    "shop",
    "cashier",
    "exposure",
    "liability",
    "session",
    "amount",
    "wallet",
)

BETTING_FIELDS: list[dict[str, Any]] = [
    {"totalBetAmount": 1150},
    {"stakes": SCENARIO_A},
    {"exposure": {"HOME": 1000}},
    {"userId": "33333333-3333-4333-8333-333333333333"},
    {"shopId": "33333333-3333-4333-8333-333333333334"},
    {"cashierId": "33333333-3333-4333-8333-333333333335"},
    {"customerCount": 12},
    {"sessionId": "abc"},
    {"seed": 42},
    {"winner": "HOME"},
    {"winningGap": 3},
]


def _field_names(model: type[Any]) -> set[str]:
    names: set[str] = set()

    for name, field in model.model_fields.items():
        names.add(name)
        annotation = field.annotation
        if isinstance(annotation, type) and hasattr(annotation, "model_fields"):
            names |= _field_names(annotation)

    return names


class TestNoInputForBets:
    def test_the_engine_signature_has_no_bet_parameter(self) -> None:
        parameters = list(inspect.signature(simulate).parameters)

        assert parameters == ["match_id", "home", "away", "configuration"]
        assert list(inspect.signature(calculate_probabilities).parameters) == [
            "home",
            "away",
            "configuration",
        ]
        assert list(inspect.signature(Simulate.__call__).parameters) == [
            "self",
            *parameters,
        ]

    def test_the_request_models_have_exactly_the_contract_fields(self) -> None:
        assert set(RunMatchRequest.model_fields) == {"match_id", "home", "away"}
        assert set(RunMatchBody.model_fields) == {"home", "away"}
        assert set(CalculateProbabilitiesRequest.model_fields) == {"home", "away"}
        assert set(SimulationTeamDto.model_fields) == {
            "team_id",
            "name",
            "short_name",
            "strength",
        }
        assert set(TeamStrengthDto.model_fields) == {
            "attack",
            "defence",
            "midfield",
            "goalkeeping",
            "pace",
            "finishing",
            "possession",
            "form",
            "home_advantage",
        }

    def test_no_field_anywhere_in_a_request_names_bet_data(self) -> None:
        for model in (RunMatchRequest, CalculateProbabilitiesRequest):
            for name in _field_names(model):
                assert not set(name.lower().split("_")) & set(FORBIDDEN_WORDS), name

        assert [f.name for f in RunMatchCommand.__dataclass_fields__.values()] == [
            "request",
            "type",
        ]

    @pytest.mark.parametrize("extra", BETTING_FIELDS)
    def test_a_payload_carrying_bet_data_is_rejected(
        self, extra: dict[str, Any]
    ) -> None:
        with pytest.raises(ValidationError) as raised:
            RunMatchRequest.model_validate({**run_match_payload(MATCH_ID), **extra})

        assert raised.value.errors()[0]["type"] == "extra_forbidden"

    @pytest.mark.parametrize("extra", BETTING_FIELDS)
    def test_bet_data_is_rejected_at_every_depth(self, extra: dict[str, Any]) -> None:
        payload = run_match_payload(MATCH_ID)
        payload["home"] = {**payload["home"], **extra}
        with pytest.raises(ValidationError):
            RunMatchRequest.model_validate(payload)

        payload = run_match_payload(MATCH_ID)
        payload["away"]["strength"] = {**payload["away"]["strength"], **extra}
        with pytest.raises(ValidationError):
            RunMatchRequest.model_validate(payload)


class TestResultIndependence:
    def test_opposite_betting_distributions_yield_the_same_match(self) -> None:
        """Scenario A piles onto HOME, scenario B onto AWAY.

        Neither distribution can be handed to the engine: the only thing a
        scenario can do is exist around the call. The result, the timeline and
        the statistics are identical.
        """
        outputs = []

        for scenario in (SCENARIO_A, SCENARIO_B):
            assert sum(scenario.values()) == 1150
            request = RunMatchRequest.model_validate(run_match_payload(MATCH_ID))
            outputs.append(
                simulate(
                    str(request.match_id),
                    request.home.to_engine(),
                    request.away.to_engine(),
                    CONFIGURATION,
                )
            )

        assert outputs[0] == outputs[1]
        assert outputs[0].result.winner in {"HOME", "AWAY", "DRAW"}

    def test_the_favourite_of_the_book_is_not_the_favourite_of_the_engine(self) -> None:
        results = {
            simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION).result
            for _ in (SCENARIO_A, SCENARIO_B)
        }

        assert len(results) == 1


class TestSessionIndependence:
    def test_identities_cannot_be_passed(self) -> None:
        for extra in (
            {"customerId": "a"},
            {"shopId": "b"},
            {"cashierId": "c"},
            {"customers": 40},
            {"actor": {"kind": "CUSTOMER", "id": "x"}},
        ):
            with pytest.raises(ValidationError):
                RunMatchRequest.model_validate({**run_match_payload(MATCH_ID), **extra})

    def test_the_result_is_the_same_whoever_is_watching(self) -> None:
        audiences = [
            {"customers": 1, "shops": 0, "cashiers": 0},
            {"customers": 5000, "shops": 40, "cashiers": 200},
        ]
        results = [
            simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
            for _audience in audiences
        ]

        assert results[0] == results[1]
