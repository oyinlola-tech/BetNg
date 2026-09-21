"""Fictional squads.

A team's squad is derived from its id alone, so the same team fields the same
players in every match and a scorers table built from the timelines is
coherent. The names are combinations from a fixed pool of given names and
surnames; none is taken from a real player.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass
from typing import Final, Literal

from .sampling import sample_index

Position = Literal["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]

STARTING_FORMATION: Final[tuple[tuple[Position, int], ...]] = (
    ("GOALKEEPER", 1),
    ("DEFENDER", 4),
    ("MIDFIELDER", 4),
    ("FORWARD", 2),
)
BENCH_FORMATION: Final[tuple[tuple[Position, int], ...]] = (
    ("GOALKEEPER", 1),
    ("DEFENDER", 2),
    ("MIDFIELDER", 2),
    ("FORWARD", 2),
)

GIVEN_NAMES: Final = (
    "Tunde", "Emeka", "Sola", "Kunle", "Chidi", "Bayo", "Femi", "Ikenna",
    "Dapo", "Uche", "Segun", "Obinna", "Yinka", "Nnamdi", "Gbenga", "Tobe",
    "Wale", "Ebuka", "Jide", "Kelechi", "Lanre", "Somto", "Niyi", "Chuka",
    "Remi", "Zubby", "Dotun", "Ifeanyi", "Kola", "Tochi", "Demola", "Nonso",
    "Bolaji", "Ugo", "Seyi", "Chibuzo", "Tayo", "Okey", "Muyiwa", "Dubem",
)  # fmt: skip

SURNAMES: Final = (
    "Adebanjo", "Okwudili", "Balarabe", "Ekpenyong", "Nwachukwu", "Oyelaran",
    "Danjuma", "Ibekwe", "Olatunde", "Ugochukwu", "Bamidele", "Tarfa",
    "Uwakwe", "Akinlade", "Oshodi", "Fashola", "Umeh", "Adeyemo", "Inyang",
    "Olaniyan", "Chiwetalu", "Gbadebo", "Nduka", "Ayodele", "Ekanem",
    "Okonjo", "Adegoke", "Anyanwu", "Durojaiye", "Ikpeme", "Ogunbiyi",
    "Ikemefuna", "Abiodun", "Arowolo", "Oladipo", "Ogbodo", "Kolawole",
    "Agbaje", "Onwuka", "Bankole", "Etuk", "Ojukwu", "Falana", "Ihejirika",
)  # fmt: skip


@dataclass(frozen=True)
class Player:
    name: str
    position: Position


@dataclass(frozen=True)
class Squad:
    starters: tuple[Player, ...]
    bench: tuple[Player, ...]


def _squad_prng(team_id: str) -> random.Random:
    digest = hashlib.sha256(f"squad:{team_id}".encode()).hexdigest()

    return random.Random(int(digest, 16))


def _draw_name(rng: random.Random, taken: set[str]) -> str:
    # The pool holds far more combinations than a squad needs, so a free name
    # is found within a few draws.
    while True:
        given = GIVEN_NAMES[sample_index(rng, len(GIVEN_NAMES))]
        surname = SURNAMES[sample_index(rng, len(SURNAMES))]
        name = f"{given} {surname}"

        if name not in taken:
            taken.add(name)
            return name


def _fill(
    rng: random.Random,
    formation: tuple[tuple[Position, int], ...],
    taken: set[str],
) -> tuple[Player, ...]:
    return tuple(
        Player(name=_draw_name(rng, taken), position=position)
        for position, count in formation
        for _ in range(count)
    )


def squad_for(team_id: str) -> Squad:
    rng = _squad_prng(team_id)
    taken: set[str] = set()

    return Squad(
        starters=_fill(rng, STARTING_FORMATION, taken),
        bench=_fill(rng, BENCH_FORMATION, taken),
    )
