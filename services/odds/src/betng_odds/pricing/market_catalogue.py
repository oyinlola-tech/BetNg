from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Final

MATCH_RESULT: Final = "MATCH_RESULT"
DOUBLE_CHANCE: Final = "DOUBLE_CHANCE"
OVER_UNDER: Final = "OVER_UNDER"
BOTH_TEAMS_TO_SCORE: Final = "BOTH_TEAMS_TO_SCORE"
GOAL_SPREAD: Final = "GOAL_SPREAD"
CORRECT_SCORE: Final = "CORRECT_SCORE"

MARKET_TYPES: Final[tuple[str, ...]] = (
    MATCH_RESULT,
    DOUBLE_CHANCE,
    OVER_UNDER,
    BOTH_TEAMS_TO_SCORE,
    GOAL_SPREAD,
    CORRECT_SCORE,
)

TOTAL_GOALS_LINES: Final[tuple[Decimal, ...]] = (
    Decimal("1.5"),
    Decimal("2.5"),
    Decimal("3.5"),
)
GOAL_SPREAD_LINE: Final = Decimal("-1.5")
CORRECT_SCORE_MAX_GOALS: Final = 3

#: The frontends' correct-score labels use an en dash.
_EN_DASH: Final = "\N{EN DASH}"

Outcome = Callable[[int, int], bool]


@dataclass(frozen=True)
class SelectionSpec:
    code: str
    label: str
    wins: Outcome


@dataclass(frozen=True)
class MarketSpec:
    type: str
    name: str
    line: Decimal | None
    selections: tuple[SelectionSpec, ...]


def market_name(market_type: str, line: Decimal | None) -> str:
    if market_type == OVER_UNDER and line is not None:
        return f"Total Goals {line}"

    return _MARKET_NAMES[market_type]


_MARKET_NAMES: Final[dict[str, str]] = {
    MATCH_RESULT: "Match Result",
    DOUBLE_CHANCE: "Double Chance",
    OVER_UNDER: "Total Goals",
    BOTH_TEAMS_TO_SCORE: "Both Teams To Score",
    GOAL_SPREAD: "Goal Spread",
    CORRECT_SCORE: "Correct Score",
}


def _line_tag(line: Decimal) -> str:
    return str(abs(line)).replace(".", "_")


def _exact_score(home_goals: int, away_goals: int) -> Outcome:
    return lambda h, a: h == home_goals and a == away_goals


def _totals_market(line: Decimal) -> MarketSpec:
    tag = _line_tag(line)

    return MarketSpec(
        type=OVER_UNDER,
        name=market_name(OVER_UNDER, line),
        line=line,
        selections=(
            SelectionSpec(f"OVER_{tag}", f"Over {line}", lambda h, a: h + a > line),
            SelectionSpec(f"UNDER_{tag}", f"Under {line}", lambda h, a: h + a < line),
        ),
    )


def _correct_score_market() -> MarketSpec:
    cells = range(CORRECT_SCORE_MAX_GOALS + 1)
    selections = [
        SelectionSpec(f"CS_{h}_{a}", f"{h} {_EN_DASH} {a}", _exact_score(h, a))
        for h in cells
        for a in cells
    ]
    selections.append(
        SelectionSpec(
            "CS_OTHER",
            "Any other score",
            lambda h, a: h > CORRECT_SCORE_MAX_GOALS or a > CORRECT_SCORE_MAX_GOALS,
        )
    )

    return MarketSpec(
        type=CORRECT_SCORE,
        name=market_name(CORRECT_SCORE, None),
        line=None,
        selections=tuple(selections),
    )


def build_catalogue(home: str, away: str) -> tuple[MarketSpec, ...]:
    spread = abs(GOAL_SPREAD_LINE)

    return (
        MarketSpec(
            type=MATCH_RESULT,
            name=market_name(MATCH_RESULT, None),
            line=None,
            selections=(
                SelectionSpec("HOME", home, lambda h, a: h > a),
                SelectionSpec("DRAW", "Draw", lambda h, a: h == a),
                SelectionSpec("AWAY", away, lambda h, a: h < a),
            ),
        ),
        MarketSpec(
            type=DOUBLE_CHANCE,
            name=market_name(DOUBLE_CHANCE, None),
            line=None,
            selections=(
                SelectionSpec("HOME_DRAW", f"{home} or Draw", lambda h, a: h >= a),
                SelectionSpec("HOME_AWAY", f"{home} or {away}", lambda h, a: h != a),
                SelectionSpec("DRAW_AWAY", f"Draw or {away}", lambda h, a: h <= a),
            ),
        ),
        *(_totals_market(line) for line in TOTAL_GOALS_LINES),
        MarketSpec(
            type=BOTH_TEAMS_TO_SCORE,
            name=market_name(BOTH_TEAMS_TO_SCORE, None),
            line=None,
            selections=(
                SelectionSpec("YES", "Yes", lambda h, a: h > 0 and a > 0),
                SelectionSpec("NO", "No", lambda h, a: h == 0 or a == 0),
            ),
        ),
        MarketSpec(
            type=GOAL_SPREAD,
            name=market_name(GOAL_SPREAD, GOAL_SPREAD_LINE),
            line=GOAL_SPREAD_LINE,
            selections=(
                SelectionSpec(
                    f"HOME_MINUS_{_line_tag(GOAL_SPREAD_LINE)}",
                    f"{home} -{spread}",
                    lambda h, a: h - a > spread,
                ),
                SelectionSpec(
                    f"AWAY_PLUS_{_line_tag(GOAL_SPREAD_LINE)}",
                    f"{away} +{spread}",
                    lambda h, a: h - a < spread,
                ),
            ),
        ),
        _correct_score_market(),
    )
