from __future__ import annotations

import itertools
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from betng_simulation.engine import (
    EXPANDED_NAME_POOL,
    LEGACY_MODEL_VERSION,
    LEGACY_NAME_POOL,
    MODEL_VERSION,
    ModelConfiguration,
    SimulationTeam,
    simulate,
    squad_for,
)
from betng_simulation.engine.names import POOLS
from betng_simulation.engine.players import name_pool_size

from .conftest import AWAY_TEAM, HOME_TEAM
from .test_rpc import call

CONFIGURATION = ModelConfiguration()
MATCH_IDS = [f"66666666-6666-4666-8666-{index:012d}" for index in range(120)]
PAYLOAD: dict[str, Any] = {
    "home": {"teamId": HOME_TEAM.team_id, "name": HOME_TEAM.name},
    "away": {"teamId": AWAY_TEAM.team_id, "name": AWAY_TEAM.name},
}


def squads(client: TestClient, payload: dict[str, Any] = PAYLOAD) -> dict[str, Any]:
    body = call(client, "simulation.getSquads", payload)

    assert body["success"] is True
    result: dict[str, Any] = body["result"]
    return result


def names(squad: dict[str, Any]) -> set[str]:
    return {player["name"] for player in (*squad["starting"], *squad["substitutes"])}


class TestGetSquads:
    def test_returns_the_contract_shape(self, client: TestClient) -> None:
        result = squads(client)

        assert set(result) == {"home", "away"}
        for side, team in (("home", HOME_TEAM), ("away", AWAY_TEAM)):
            squad = result[side]
            assert set(squad) == {"teamId", "formation", "starting", "substitutes"}
            assert squad["teamId"] == team.team_id
            assert squad["formation"] == "4-4-2"
            for player in (*squad["starting"], *squad["substitutes"]):
                assert set(player) == {"id", "name", "shirt", "position"}

    def test_eleven_starters_with_exactly_one_goalkeeper(
        self, client: TestClient
    ) -> None:
        for squad in squads(client).values():
            starting, bench = squad["starting"], squad["substitutes"]
            everyone = [*starting, *bench]

            assert len(starting) == 11
            assert [p["position"] for p in starting].count("GK") == 1
            assert 1 <= len(bench) <= 15
            assert [p["shirt"] for p in everyone] == list(range(1, len(everyone) + 1))
            assert len({p["id"] for p in everyone}) == len(everyone)
            assert len(names(squad)) == len(everyone)

    def test_is_deterministic_per_team(self, client: TestClient) -> None:
        first = squads(client)
        swapped = squads(client, {"home": PAYLOAD["away"], "away": PAYLOAD["home"]})

        assert squads(client) == first
        assert swapped == {"home": first["away"], "away": first["home"]}
        assert names(first["home"]) != names(first["away"])

    def test_the_team_name_does_not_change_the_squad(self, client: TestClient) -> None:
        renamed = {**PAYLOAD, "home": {**PAYLOAD["home"], "name": "Renamed FC"}}

        assert squads(client, renamed) == squads(client)

    @pytest.mark.parametrize(
        "payload",
        [
            {**PAYLOAD, "matchId": "44444444-4444-4444-8444-444444444444"},
            {**PAYLOAD, "stakes": {"HOME": 1000}},
            {**PAYLOAD, "home": {**PAYLOAD["home"], "userId": "u-1"}},
            {**PAYLOAD, "home": {**PAYLOAD["home"], "teamId": "not-a-uuid"}},
            {**PAYLOAD, "away": {"teamId": AWAY_TEAM.team_id, "name": ""}},
            {"home": PAYLOAD["home"]},
        ],
    )
    def test_the_payload_is_strict(
        self, client: TestClient, payload: dict[str, Any]
    ) -> None:
        body = call(client, "simulation.getSquads", payload)

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

    def test_carries_nothing_about_a_result(self, client: TestClient) -> None:
        text = str(squads(client)).lower()

        for word in ("goal", "score", "winner", "seed", "minute"):
            assert word not in text


class TestTimelinePlayersAreInTheSquads:
    def test_every_named_player_is_in_the_squad_of_their_side(
        self, client: TestClient
    ) -> None:
        result = squads(client)
        squad_names = {"HOME": names(result["home"]), "AWAY": names(result["away"])}
        starters = {
            side: {player["name"] for player in result[side.lower()]["starting"]}
            for side in ("HOME", "AWAY")
        }
        named = 0

        for match_id in MATCH_IDS:
            output = simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)

            for event in output.events:
                for name in (event.player, event.secondary_player):
                    if name is None:
                        continue

                    assert event.side is not None
                    assert name in squad_names[event.side]
                    named += 1

                if event.type == "SUBSTITUTION" and event.side is not None:
                    assert event.secondary_player in starters[event.side]
                    assert event.player not in starters[event.side]

        assert named > len(MATCH_IDS)


class TestNamePools:
    def test_each_model_version_pins_its_own_squads(self, client: TestClient) -> None:
        legacy = squads(client, {**PAYLOAD, "modelVersion": LEGACY_MODEL_VERSION})
        current = squads(client, {**PAYLOAD, "modelVersion": MODEL_VERSION})

        assert current == squads(client)
        assert names(legacy["home"]) == {
            player.name
            for player in (
                *squad_for(HOME_TEAM.team_id, LEGACY_NAME_POOL).starters,
                *squad_for(HOME_TEAM.team_id, LEGACY_NAME_POOL).bench,
            )
        }
        assert names(legacy["home"]) != names(current["home"])

        body = call(client, "simulation.getSquads", {**PAYLOAD, "modelVersion": "x"})
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

    def test_the_expanded_pool_makes_cross_team_collisions_rare(self) -> None:
        team_ids = [str(uuid.UUID(int=index * 7919 + 1)) for index in range(120)]

        def shared_names(pool: int) -> float:
            rosters = [
                {p.name for p in (*s.starters, *s.bench)}
                for s in (squad_for(team_id, pool) for team_id in team_ids)
            ]
            overlaps = sum(len(a & b) for a, b in itertools.combinations(rosters, 2))
            return overlaps / (len(rosters) * (len(rosters) - 1) / 2)

        assert name_pool_size(EXPANDED_NAME_POOL) > 10 * name_pool_size(
            LEGACY_NAME_POOL
        )
        assert shared_names(EXPANDED_NAME_POOL) < 0.03
        assert shared_names(EXPANDED_NAME_POOL) < shared_names(LEGACY_NAME_POOL) / 5


def nationality_of(name: str) -> set[str]:
    """Every pool a full name could have come from."""
    given, _, surname = name.partition(" ")

    return {
        country
        for country, (given_names, surnames) in POOLS.items()
        if given in given_names and surname in surnames
    }


def domestic_count(squad_names: list[str], country: str) -> int:
    return sum(1 for name in squad_names if country in nationality_of(name))


class TestSquadsFollowTheClubsCountry:
    """The bug this guards: every club in the game fielded one country's names."""

    def test_a_squad_is_mostly_its_own_country_and_never_one_pool(self) -> None:
        for country, team_id in (
            ("England", "33333333-3333-4333-8333-000000000001"),
            ("Spain", "33333333-3333-4333-8333-000000000002"),
            ("Italy", "33333333-3333-4333-8333-000000000003"),
            ("France", "33333333-3333-4333-8333-000000000004"),
        ):
            squad = squad_for(team_id, EXPANDED_NAME_POOL, country)
            roster = [player.name for player in squad.starters + squad.bench]
            key = country.upper()
            domestic = domestic_count(roster, key)

            assert 0 < domestic < len(roster), (
                f"{country} squad is all-or-nothing domestic: {roster}"
            )
            # Every name resolves to some pool: none are left over from the old one.
            assert all(nationality_of(name) for name in roster)

    def test_the_country_decides_the_squad(self) -> None:
        team_id = "33333333-3333-4333-8333-000000000010"
        english = squad_for(team_id, EXPANDED_NAME_POOL, "England")
        spanish = squad_for(team_id, EXPANDED_NAME_POOL, "Spain")

        assert {player.name for player in english.starters} != {
            player.name for player in spanish.starters
        }

    def test_an_unknown_country_still_fields_a_full_squad(self) -> None:
        squad = squad_for(
            "33333333-3333-4333-8333-000000000011", EXPANDED_NAME_POOL, "Narnia"
        )
        roster = [player.name for player in squad.starters + squad.bench]

        assert len(set(roster)) == len(roster)
        assert all(nationality_of(name) for name in roster)

    def test_without_a_country_the_older_pool_is_unchanged(self) -> None:
        team_id = "33333333-3333-4333-8333-000000000012"

        assert squad_for(team_id, EXPANDED_NAME_POOL) == squad_for(
            team_id, EXPANDED_NAME_POOL, None
        )

    def test_keepers_lean_domestic(self) -> None:
        keepers = [
            squad_for(
                f"44444444-4444-4444-8444-{index:012d}", EXPANDED_NAME_POOL, "Spain"
            )
            .starters[0]
            .name
            for index in range(120)
        ]

        assert all(player for player in keepers)
        assert domestic_count(keepers, "SPAIN") > len(keepers) // 2


class TestLineupsAndTimelineAgreeOnNames:
    def test_the_squad_endpoint_and_the_timeline_name_the_same_people(
        self, client: TestClient
    ) -> None:
        home = SimulationTeam(
            HOME_TEAM.team_id,
            HOME_TEAM.name,
            HOME_TEAM.short_name,
            HOME_TEAM.strength,
            "Spain",
        )
        away = SimulationTeam(
            AWAY_TEAM.team_id,
            AWAY_TEAM.name,
            AWAY_TEAM.short_name,
            AWAY_TEAM.strength,
            "Spain",
        )
        result = squads(
            client,
            {
                "home": {"teamId": home.team_id, "name": home.name, "country": "Spain"},
                "away": {"teamId": away.team_id, "name": away.name, "country": "Spain"},
            },
        )
        squad_names = {"HOME": names(result["home"]), "AWAY": names(result["away"])}
        named = 0

        for match_id in MATCH_IDS[:40]:
            output = simulate(match_id, home, away, CONFIGURATION)

            for event in output.events:
                for name in (event.player, event.secondary_player):
                    if name is None:
                        continue

                    assert event.side is not None
                    assert name in squad_names[event.side], (
                        f"{name} is in the timeline but not in the {event.side} squad"
                    )
                    named += 1

        assert named > 0
