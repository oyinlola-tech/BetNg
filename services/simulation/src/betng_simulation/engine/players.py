from __future__ import annotations

import functools
import hashlib
import random
from dataclasses import dataclass
from typing import Final, Literal

from .names import (
    DEFAULT_DOMESTIC_SHARE,
    DOMESTIC_SHARE,
    FOREIGN_MIX,
    GOALKEEPER_DOMESTIC_BONUS,
    POOLS,
    NamePool,
    resolve_country,
)
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


EXPANDED_GIVEN_NAMES: Final = (
    *GIVEN_NAMES,
    "Abdul", "Adamu", "Adewale", "Akin", "Amaechi", "Anayo", "Aliyu", "Babatunde",
    "Bello", "Bode", "Chiedu", "Chijioke", "Chinedu", "Chukwuma", "Damilare",
    "Dayo", "Ebere", "Efosa", "Ehis", "Ejike", "Ekene", "Emeka", "Enyinna",
    "Eze", "Folarin", "Funsho", "Garba", "Gozie", "Ibrahim", "Idris", "Ifeoma",
    "Ikechukwu", "Isa", "Jelani", "Jibola", "Kayode", "Kehinde", "Lekan",
    "Lukman", "Mayowa", "Mobolaji", "Musa", "Nkem", "Nnaemeka", "Obi",
    "Obafemi", "Odion", "Oghenekaro", "Olamide", "Olumide", "Onyeka", "Osagie",
    "Osaze", "Oyelowo", "Rotimi", "Sadiq", "Sani", "Shehu", "Sunday", "Taiwo",
    "Temitope", "Tijani", "Timilehin", "Tobi", "Uchenna", "Umar", "Usman",
    "Victor", "Yakubu", "Yusuf", "Zainab", "Ademola", "Afolabi", "Anietie",
    "Bassey", "Chimaobi", "Ekow", "Eniola", "Fisayo", "Ifedayo", "Iyke",
    "Jamiu", "Kachi", "Kamsi", "Mubarak", "Nuhu", "Ochuko", "Ovie", "Pelumi",
    "Ramon", "Samad", "Tega", "Uzo", "Wasiu", "Yemi", "Zik",
)  # fmt: skip

EXPANDED_SURNAMES: Final = (
    *SURNAMES,
    "Abubakar", "Achebe", "Adeleke", "Adewumi", "Afolayan", "Agu", "Ahmed",
    "Ajayi", "Akande", "Akpan", "Alabi", "Aminu", "Amadi", "Aniebonam", "Asuquo",
    "Awoniyi", "Azikiwe", "Babangida", "Bakare", "Bello", "Chukwu", "Dike",
    "Egwu", "Ejiofor", "Eke", "Ekwueme", "Emenike", "Eneh", "Enyeama", "Eze",
    "Ezeji", "Fagbemi", "Fasanya", "Garba", "Idowu", "Igwe", "Iheanacho",
    "Ikeme", "Iwobi", "Jegede", "Kalu", "Kanu", "Lawal", "Mbah", "Mikel",
    "Mohammed", "Musa", "Nnadi", "Nwankwo", "Nwosu", "Obasi", "Obi", "Obiora",
    "Odemwingie", "Odion", "Ogbu", "Ogunleye", "Ojo", "Okafor", "Okeke",
    "Okocha", "Okon", "Okoro", "Okoye", "Olawale", "Olayinka", "Omeruo",
    "Onazi", "Onuoha", "Onyekuru", "Osimhen", "Ottah", "Oyewole", "Salami",
    "Shittu", "Sodje", "Taiwo", "Uche", "Udeh", "Udoh", "Ukah", "Umar",
    "Usman", "Uzoho", "Yakubu", "Yobo", "Yusuf", "Adamu", "Aigbogun", "Akinwale",
    "Alade", "Anichebe", "Babatunde", "Chima", "Dosunmu", "Ebiere", "Edet",
    "Egbuna", "Ekong", "Elegbede", "Esan", "Ezekwesili", "Ibe", "Ighalo",
    "Isiaka", "Kolade", "Madu", "Njoku", "Nnamani", "Obaseki", "Ogbonna",
    "Ogunmola", "Okagbue", "Olaoye", "Onyali", "Orji", "Otedola", "Sanusi",
    "Soyinka", "Tinubu", "Uzor", "Wike", "Zubairu",
)  # fmt: skip

LEGACY_NAME_POOL: Final = 1
EXPANDED_NAME_POOL: Final = 2

_NAME_POOLS: Final[dict[int, tuple[tuple[str, ...], tuple[str, ...]]]] = {
    LEGACY_NAME_POOL: (GIVEN_NAMES, SURNAMES),
    EXPANDED_NAME_POOL: (
        tuple(dict.fromkeys(EXPANDED_GIVEN_NAMES)),
        tuple(dict.fromkeys(EXPANDED_SURNAMES)),
    ),
}


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


def _draw_name(
    rng: random.Random,
    taken: set[str],
    given_names: tuple[str, ...],
    surnames: tuple[str, ...],
) -> str:
    while True:
        given = given_names[sample_index(rng, len(given_names))]
        surname = surnames[sample_index(rng, len(surnames))]
        name = f"{given} {surname}"

        if name not in taken:
            taken.add(name)
            return name


def _fill(
    rng: random.Random,
    formation: tuple[tuple[Position, int], ...],
    taken: set[str],
    pool: NamePool,
) -> tuple[Player, ...]:
    return tuple(
        Player(name=_draw_name(rng, taken, *pool), position=position)
        for position, count in formation
        for _ in range(count)
    )


def _weighted_choice(rng: random.Random, weighted: tuple[tuple[str, int], ...]) -> str:
    roll = sample_index(rng, sum(weight for _, weight in weighted))
    seen = 0

    for key, weight in weighted:
        seen += weight
        if roll < seen:
            return key

    return weighted[-1][0]


@functools.lru_cache(maxsize=32)
def _foreign_mix(domestic: str | None) -> tuple[tuple[str, int], ...]:
    """Return the foreign mix without the club's own country.

    Leaving it in would let a "foreign" draw land back home, so the domestic
    share would quietly run above the figure it is set to.
    """
    return tuple((name, weight) for name, weight in FOREIGN_MIX if name != domestic)


def _nationality(
    rng: random.Random, domestic: str | None, position: Position
) -> str:
    """Pick where one player is from: the club's country, or the foreign mix."""
    if domestic is None:
        return _weighted_choice(rng, FOREIGN_MIX)

    share = DOMESTIC_SHARE.get(domestic, DEFAULT_DOMESTIC_SHARE)

    if position == "GOALKEEPER":
        share = min(100, share + GOALKEEPER_DOMESTIC_BONUS)

    if sample_index(rng, 100) < share:
        return domestic

    return _weighted_choice(rng, _foreign_mix(domestic))


def _fill_national(
    rng: random.Random,
    formation: tuple[tuple[Position, int], ...],
    taken: set[str],
    domestic: str | None,
) -> tuple[Player, ...]:
    return tuple(
        Player(
            name=_draw_name(rng, taken, *POOLS[_nationality(rng, domestic, position)]),
            position=position,
        )
        for position, count in formation
        for _ in range(count)
    )


def name_pool_for(model_version: str) -> int:
    """Return the name pool a model version draws squads from."""
    return LEGACY_NAME_POOL if model_version == "poisson-1.0" else EXPANDED_NAME_POOL


def name_pool_size(name_pool: int) -> int:
    given_names, surnames = _NAME_POOLS[name_pool]

    return len(given_names) * len(surnames)


@functools.lru_cache(maxsize=1024)
def squad_for(
    team_id: str,
    name_pool: int = EXPANDED_NAME_POOL,
    country: str | None = None,
) -> Squad:
    """Return the team's squad, seeded from the team id alone.

    Given the club's country the squad is drawn mostly from that country and the
    rest from the foreign mix, because league football is cosmopolitan. Without
    one the older single-pool behaviour stands, so a caller that does not know
    the country still gets a squad.

    The PRNG here is the team's own, never the match seed, so which names are
    drawn cannot move a scoreline.
    """
    rng = _squad_prng(team_id)
    taken: set[str] = set()

    if country is None:
        pool = _NAME_POOLS[name_pool]

        return Squad(
            starters=_fill(rng, STARTING_FORMATION, taken, pool),
            bench=_fill(rng, BENCH_FORMATION, taken, pool),
        )

    domestic = resolve_country(country)

    return Squad(
        starters=_fill_national(rng, STARTING_FORMATION, taken, domestic),
        bench=_fill_national(rng, BENCH_FORMATION, taken, domestic),
    )
