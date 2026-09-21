"""The SQL the analytics reader issues.

Every statement is assembled from the constant fragments in this module; a
caller's value only ever travels as a bound parameter. Status and enum columns
are compared as text, as the shared read model (docs/architecture.md §8)
requires, so the statements work whether the owner stored an enum or text.

The formulas are documented in the service README.
"""

from __future__ import annotations

import json
from dataclasses import replace
from typing import Any, Final

from ..constants import NO_KEY
from ..types import BetScope, ReaderDimension, Window

Params = dict[str, Any]

#: The figures of a set of bets, over the alias ``s`` of the ``scoped`` CTE.
BET_FIGURES: Final = """
    COUNT(*) AS bets,
    COUNT(*) FILTER (WHERE s.status = 'PENDING') AS pending_bets,
    COUNT(*) FILTER (WHERE s.status = 'WON') AS winning_bets,
    COUNT(*) FILTER (WHERE s.status = 'LOST') AS losing_bets,
    COUNT(*) FILTER (WHERE s.status = 'VOID') AS void_bets,
    COUNT(*) FILTER (WHERE s.status = 'CANCELLED') AS cancelled_bets,
    COALESCE(SUM(s.stake) FILTER (WHERE s.status <> 'CANCELLED'), 0)::bigint
        AS stake,
    COALESCE(SUM(s.stake) FILTER (WHERE s.status = 'PENDING'), 0)::bigint
        AS pending_stake,
    COALESCE(SUM(s.stake) FILTER (WHERE s.status IN ('WON', 'LOST')), 0)::bigint
        AS settled_stake,
    COALESCE(SUM(s.stake) FILTER (WHERE s.status = 'VOID'), 0)::bigint
        AS void_stake,
    COALESCE(SUM(s.payout) FILTER (WHERE s.status = 'WON'), 0)::bigint
        AS payout,
    COALESCE(
        SUM(s.potential_payout - s.stake) FILTER (WHERE s.status = 'PENDING'), 0
    )::bigint AS pending_liability
"""

#: How many distinct bettors and points of sale a set of bets came from.
PARTY_FIGURES: Final = """
    COUNT(DISTINCT s.user_id) AS customers,
    COUNT(DISTINCT s.shop_id) AS shops,
    COUNT(DISTINCT s.cashier_id) AS cashiers
"""

_MARKET_KEY: Final = "l.market_type::text || COALESCE(':' || l.line::text, '')"

#: dimension -> (key expression, label expression) over a leg ``l``.
_LEG_DIMENSIONS: Final[dict[str, tuple[str, str]]] = {
    "league": ("l.league_id::text", "l.league_name"),
    "match": ("l.match_id::text", "l.match_label"),
    "market": (_MARKET_KEY, "l.market_label"),
    "selection": (
        f"{_MARKET_KEY} || ':' || l.selection_code",
        "l.market_label || ' - ' || l.selection_label",
    ),
    "market_id": ("l.market_id::text", "l.market_label"),
    "selection_id": (
        "l.selection_id::text",
        "l.market_label || ' - ' || l.selection_label",
    ),
}

#: dimension -> (key, label, join, order) over a scoped bet ``s``.
_BET_DIMENSIONS: Final[dict[str, tuple[str, str, str, str]]] = {
    "shop": (
        f"COALESCE(s.shop_id::text, '{NO_KEY}')",
        "COALESCE(sh.name, s.shop_id::text, 'No shop (online)')",
        "LEFT JOIN identity.shops sh ON sh.id = s.shop_id",
        "stake DESC, key",
    ),
    "cashier": (
        f"COALESCE(s.cashier_id::text, '{NO_KEY}')",
        "COALESCE(ca.display_name, s.cashier_id::text, 'No cashier (online)')",
        "LEFT JOIN identity.cashiers ca ON ca.id = s.cashier_id",
        "stake DESC, key",
    ),
    "customer": (
        f"COALESCE(s.user_id::text, '{NO_KEY}')",
        "COALESCE(cu.display_name, s.user_id::text, 'Walk-in (shop ticket)')",
        "LEFT JOIN identity.customers cu ON cu.id = s.user_id",
        "stake DESC, key",
    ),
    "channel": ("s.channel", "s.channel", "", "key"),
    "hour": (
        "to_char(date_trunc('hour', s.placed_at AT TIME ZONE %(tz)s::text), "
        "'YYYY-MM-DD\"T\"HH24:00')",
        "to_char(date_trunc('hour', s.placed_at AT TIME ZONE %(tz)s::text), "
        "'YYYY-MM-DD HH24:00')",
        "",
        "key",
    ),
    "day": (
        "to_char(s.placed_at AT TIME ZONE %(tz)s::text, 'YYYY-MM-DD')",
        "to_char(s.placed_at AT TIME ZONE %(tz)s::text, 'YYYY-MM-DD')",
        "",
        "key",
    ),
}


def window_conditions(column: str, window: Window, params: Params) -> list[str]:
    conditions: list[str] = []

    if window.start is not None:
        params["from"] = window.start
        conditions.append(f"{column} >= %(from)s")

    if window.end is not None:
        params["to"] = window.end
        conditions.append(f"{column} < %(to)s")

    return conditions


def scoped_cte(scope: BetScope, params: Params) -> str:
    """Return the ``scoped`` CTE: the accepted bets a figure covers.

    Every row of `betting.bets` is an accepted bet, whoever placed it and
    wherever. A scope narrows the population; it never samples it.
    """
    conditions = window_conditions("b.placed_at", scope.window, params)

    equalities = {
        "shop_id": ("b.shop_id", scope.shop_id),
        "user_id": ("b.user_id", scope.user_id),
        "cashier_id": ("b.cashier_id", scope.cashier_id),
        "status": ("b.status::text", scope.status),
        "channel": ("b.channel::text", scope.channel),
    }

    for name, (column, value) in equalities.items():
        if value is not None:
            params[name] = value
            conditions.append(f"{column} = %({name})s")

    for name, value in (
        ("league_id", scope.league_id),
        ("match_id", scope.match_id),
    ):
        if value is not None:
            params[name] = value
            conditions.append(
                "EXISTS (SELECT 1 FROM betting.bet_selections x "
                f"WHERE x.bet_id = b.id AND x.{name} = %({name})s)"
            )

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    return f"""
    scoped AS (
        SELECT b.id, b.user_id, b.channel::text AS channel, b.shop_id,
               b.cashier_id, b.stake, b.currency, b.total_odds,
               b.potential_payout, b.status::text AS status, b.payout,
               b.risk_decision_id, b.placed_at, b.settled_at, b.cancelled_at
        FROM betting.bets b
        {where}
    )"""


def leg_conditions(scope: BetScope) -> str:
    """Narrow legs to the league or match the scope names.

    The parameters are the ones :func:`scoped_cte` already bound.
    """
    conditions = ""

    if scope.league_id is not None:
        conditions += " AND l.league_id = %(league_id)s"

    if scope.match_id is not None:
        conditions += " AND l.match_id = %(match_id)s"

    return conditions


def overview_sql(scope: BetScope, params: Params) -> str:
    decisions = window_conditions("d.created_at", scope.window, params)

    if scope.shop_id is not None:
        decisions.append("d.shop_id = %(shop_id)s")

    if scope.match_id is not None:
        params["match_leg_camel"] = _json_leg("matchId", scope.match_id)
        params["match_leg_snake"] = _json_leg("match_id", scope.match_id)
        decisions.append(
            "(d.legs @> %(match_leg_camel)s::jsonb "
            "OR d.legs @> %(match_leg_snake)s::jsonb)"
        )

    decisions_where = f"WHERE {' AND '.join(decisions)}" if decisions else ""

    return f"""
    WITH {scoped_cte(scope, params)},
    figures AS (
        SELECT {BET_FIGURES}, {PARTY_FIGURES},
               MIN(s.placed_at) AS first_placed_at,
               MAX(s.placed_at) AS last_placed_at
        FROM scoped s
    ),
    legs AS (
        SELECT COUNT(DISTINCT l.match_id) AS matches,
               COUNT(DISTINCT l.market_id) AS markets
        FROM betting.bet_selections l
        JOIN scoped s ON s.id = l.bet_id
        WHERE TRUE {leg_conditions(scope)}
    ),
    decisions AS (
        SELECT COUNT(*) FILTER (WHERE d.decision::text = 'LIMIT') AS limited_bets,
               COUNT(*) FILTER (WHERE d.decision::text = 'REJECT')
                   AS rejected_bets
        FROM risk.risk_decisions d
        {decisions_where}
    )
    SELECT * FROM figures, legs, decisions
    """


def _json_leg(key: str, match_id: str) -> str:
    """Build the containment probe for one leg of `risk_decisions.legs`."""
    return json.dumps([{key: match_id}])


def breakdown_sql(dimension: ReaderDimension, scope: BetScope, params: Params) -> str:
    if dimension in _LEG_DIMENSIONS:
        key, label = _LEG_DIMENSIONS[dimension]

        return f"""
        WITH {scoped_cte(scope, params)},
        keyed AS (
            SELECT {key} AS key, MIN({label}) AS label, l.bet_id
            FROM betting.bet_selections l
            JOIN scoped s ON s.id = l.bet_id
            WHERE TRUE {leg_conditions(scope)}
            GROUP BY 1, l.bet_id
        )
        SELECT k.key,
               CASE WHEN COUNT(DISTINCT k.label) = 1 THEN MIN(k.label)
                    ELSE k.key END AS label,
               {BET_FIGURES}
        FROM keyed k
        JOIN scoped s ON s.id = k.bet_id
        GROUP BY k.key
        ORDER BY stake DESC, key
        LIMIT %(limit)s
        """

    key, label, join, order = _BET_DIMENSIONS[dimension]

    return f"""
    WITH {scoped_cte(scope, params)}
    SELECT {key} AS key, MIN({label}) AS label, {BET_FIGURES}
    FROM scoped s
    {join}
    GROUP BY 1
    ORDER BY {order}
    LIMIT %(limit)s
    """


#: session kind -> the `date_trunc` unit and step it is cut by. The only source
#: of the unit that reaches the statement text.
_BUCKET_UNITS: Final[dict[str, str]] = {"HOUR": "hour", "DAY": "day"}

#: wallet owner kinds a transaction count may be asked for.
_WALLET_OWNERS: Final[dict[str, str]] = {"CUSTOMER": "CUSTOMER", "SHOP": "SHOP"}


def bucket_sessions_sql(kind: str, scope: BetScope, params: Params) -> str:
    """Sessions cut by the clock: ``kind`` is ``HOUR`` or ``DAY``."""
    unit = _BUCKET_UNITS[kind]

    return f"""
    WITH {scoped_cte(scope, params)},
    bucketed AS (
        SELECT s.*,
               date_trunc('{unit}', s.placed_at AT TIME ZONE %(tz)s::text)
                   AS bucket
        FROM scoped s
    ),
    bet_figures AS (
        SELECT s.bucket, {BET_FIGURES}, {PARTY_FIGURES}
        FROM bucketed s
        GROUP BY s.bucket
    ),
    leg_figures AS (
        SELECT s.bucket,
               COUNT(DISTINCT l.market_id) AS markets,
               COUNT(DISTINCT l.match_id) AS matches
        FROM bucketed s
        JOIN betting.bet_selections l ON l.bet_id = s.id
        WHERE TRUE {leg_conditions(scope)}
        GROUP BY s.bucket
    )
    SELECT f.*,
           COALESCE(g.markets, 0) AS markets,
           COALESCE(g.matches, 0) AS matches,
           f.bucket AT TIME ZONE %(tz)s::text AS starts_at,
           (f.bucket + interval '1 {unit}') AT TIME ZONE %(tz)s::text AS ends_at,
           to_char(f.bucket, 'YYYYMMDD') AS day_code,
           to_char(f.bucket, 'YYYY-MM-DD') AS day_label,
           EXTRACT(HOUR FROM f.bucket)::int AS hour
    FROM bet_figures f
    LEFT JOIN leg_figures g USING (bucket)
    ORDER BY f.bucket DESC
    LIMIT %(limit)s
    """


def round_sessions_sql(scope: BetScope, params: Params) -> str:
    """Sessions cut by the fixture list: league, season and matchday."""
    return f"""
    WITH {scoped_cte(scope, params)},
    rounds AS (
        SELECT f.league_id, f.season::text AS season, f.matchday,
               MIN(f.kickoff_at) AS starts_at, MAX(f.kickoff_at) AS ends_at
        FROM match.fixtures f
        GROUP BY 1, 2, 3
    ),
    leg_rounds AS (
        SELECT l.bet_id, l.market_id, l.match_id,
               f.league_id, f.season::text AS season, f.matchday
        FROM betting.bet_selections l
        JOIN scoped s ON s.id = l.bet_id
        JOIN match.matches m ON m.id = l.match_id
        JOIN match.fixtures f ON f.id = m.fixture_id
        WHERE TRUE {leg_conditions(scope)}
    ),
    keyed AS (
        SELECT DISTINCT league_id, season, matchday, bet_id FROM leg_rounds
    ),
    bet_figures AS (
        SELECT k.league_id, k.season, k.matchday, {BET_FIGURES}, {PARTY_FIGURES}
        FROM keyed k
        JOIN scoped s ON s.id = k.bet_id
        GROUP BY 1, 2, 3
    ),
    leg_figures AS (
        SELECT league_id, season, matchday,
               COUNT(DISTINCT market_id) AS markets,
               COUNT(DISTINCT match_id) AS matches
        FROM leg_rounds
        GROUP BY 1, 2, 3
    )
    SELECT f.*, g.markets, g.matches, r.starts_at, r.ends_at,
           lg.code AS league_code, lg.name AS league_name
    FROM bet_figures f
    JOIN leg_figures g USING (league_id, season, matchday)
    JOIN rounds r USING (league_id, season, matchday)
    JOIN match.leagues lg ON lg.id = f.league_id
    ORDER BY r.starts_at DESC, lg.code
    LIMIT %(limit)s
    """


_SOURCE_FIGURES: Final = """
    COUNT(*) FILTER (WHERE {o} IN ('WON', 'LOST')) AS {p}_settled_bets,
    COUNT(*) FILTER (WHERE {o} = 'VOID') AS {p}_void_bets,
    COALESCE(SUM({a}.stake) FILTER (WHERE {o} IN ('WON', 'LOST')), 0)::bigint
        AS {p}_gross_stakes,
    COALESCE(SUM({a}.payout) FILTER (WHERE {o} = 'WON'), 0)::bigint
        AS {p}_gross_payouts,
    COALESCE(SUM({a}.stake) FILTER (WHERE {o} = 'VOID'), 0)::bigint
        AS {p}_refunded_stakes
"""


def operator_sql(scope: BetScope, params: Params) -> str:
    """One population of bets, summed from three independent sources."""
    bets = _SOURCE_FIGURES.format(o="s.status", a="s", p="bets")
    settlements = _SOURCE_FIGURES.format(o="t.outcome", a="t", p="settlements")
    ledger = _SOURCE_FIGURES.format(o="e.outcome::text", a="e", p="ledger")

    return f"""
    WITH {scoped_cte(scope, params)},
    latest AS (
        SELECT DISTINCT ON (st.bet_id)
               st.id, st.bet_id, st.outcome::text AS outcome, st.stake, st.payout
        FROM settlement.settlements st
        JOIN scoped s ON s.id = st.bet_id
        ORDER BY st.bet_id, st.revision DESC
    ),
    from_bets AS (
        SELECT {bets},
               MIN(s.placed_at) AS first_placed_at,
               MAX(s.placed_at) AS last_placed_at
        FROM scoped s
    ),
    from_settlements AS (SELECT {settlements} FROM latest t),
    from_ledger AS (
        SELECT {ledger}
        FROM settlement.operator_ledger_entries e
        JOIN latest t ON t.id = e.settlement_id
    )
    SELECT * FROM from_bets, from_settlements, from_ledger
    """


PLATFORM_OVERVIEW_SQL: Final = """
    WITH today AS (
        SELECT date_trunc('day', now() AT TIME ZONE %(tz)s::text)
               AT TIME ZONE %(tz)s::text AS starts_at
    ),
    todays AS (
        SELECT b.shop_id, b.stake, b.payout, b.status::text AS status
        FROM betting.bets b, today t
        WHERE b.placed_at >= t.starts_at
    )
    SELECT
        (SELECT COUNT(*) FROM identity.customers c
          WHERE c.status::text = 'ACTIVE'
            AND c.last_active_at >= now() - make_interval(mins => %(minutes)s))
            AS active_users,
        (SELECT COUNT(DISTINCT s.shop_id) FROM todays s) AS active_shops,
        (SELECT COUNT(*) FROM betting.bets b WHERE b.status::text = 'PENDING')
            AS open_bets,
        (SELECT COUNT(*) FROM match.matches m WHERE m.status::text = 'IN_PLAY')
            AS live_matches,
        (SELECT COALESCE(SUM(s.stake) FILTER (WHERE s.status <> 'CANCELLED'), 0)
            FROM todays s)::bigint AS stake,
        (SELECT COALESCE(SUM(s.stake) FILTER (
                    WHERE s.status IN ('WON', 'LOST')), 0)
            FROM todays s)::bigint AS settled_stake,
        (SELECT COALESCE(SUM(s.payout) FILTER (WHERE s.status = 'WON'), 0)
            FROM todays s)::bigint AS payout
"""

_DAY_BOUNDS: Final = (
    "{column} >= (%(first)s::date::timestamp AT TIME ZONE %(tz)s::text) "
    "AND {column} < ((%(last)s::date + 1)::timestamp AT TIME ZONE %(tz)s::text)"
)

_DAYS_CTE: Final = """
    days AS (
        SELECT d::date AS day
        FROM generate_series(
            %(first)s::date::timestamp, %(last)s::date::timestamp,
            interval '1 day'
        ) AS d
    )"""

DAILY_REPORTS_SQL: Final = f"""
    WITH {_DAYS_CTE},
    figures AS (
        SELECT (b.placed_at AT TIME ZONE %(tz)s::text)::date AS day,
               COUNT(*) AS bets,
               COALESCE(SUM(b.stake) FILTER (
                   WHERE b.status::text <> 'CANCELLED'), 0)::bigint AS stake,
               COALESCE(SUM(b.stake) FILTER (
                   WHERE b.status::text IN ('WON', 'LOST')), 0)::bigint
                   AS settled_stake,
               COALESCE(SUM(b.payout) FILTER (
                   WHERE b.status::text = 'WON'), 0)::bigint AS payout,
               COALESCE(SUM(b.stake) FILTER (
                   WHERE b.status::text <> 'CANCELLED'
                     AND b.channel::text = 'ONLINE'), 0)::bigint AS online_stake,
               COALESCE(SUM(b.stake) FILTER (
                   WHERE b.status::text <> 'CANCELLED'
                     AND b.channel::text = 'SHOP'), 0)::bigint AS shop_stake
        FROM betting.bets b
        WHERE {_DAY_BOUNDS.format(column="b.placed_at")}
        GROUP BY 1
    )
    SELECT d.day,
           COALESCE(f.bets, 0) AS bets,
           COALESCE(f.stake, 0)::bigint AS stake,
           COALESCE(f.settled_stake, 0)::bigint AS settled_stake,
           COALESCE(f.payout, 0)::bigint AS payout,
           COALESCE(f.online_stake, 0)::bigint AS online_stake,
           COALESCE(f.shop_stake, 0)::bigint AS shop_stake
    FROM days d
    LEFT JOIN figures f USING (day)
    ORDER BY d.day
"""

_SUBJECT_LABELS: Final[dict[str, str]] = {
    "CUSTOMER": "SELECT c.display_name AS label FROM identity.customers c "
    "WHERE c.id = %(subject_id)s",
    "SHOP": "SELECT sh.name AS label FROM identity.shops sh "
    "WHERE sh.id = %(subject_id)s",
    "CASHIER": "SELECT ca.display_name AS label FROM identity.cashiers ca "
    "WHERE ca.id = %(subject_id)s",
}


def subject_label_sql(kind: str) -> str:
    return _SUBJECT_LABELS[kind]


def _wallet_transactions(kind: str, window: Window, params: Params) -> str:
    owner_type = _WALLET_OWNERS[kind]
    conditions = " AND ".join(
        [
            f"a.owner_type::text = '{owner_type}'",
            "a.owner_id = %(subject_id)s",
            *window_conditions("t.created_at", window, params),
        ]
    )

    return f"""
        (SELECT COUNT(*)
           FROM wallet.wallet_transactions t
           JOIN wallet.wallet_accounts a ON a.id = t.account_id
          WHERE {conditions}) AS transactions"""


def account_sql(kind: str, scope: BetScope, params: Params) -> str:
    extras: list[str] = []

    if kind == "CUSTOMER":
        extras.append(_wallet_transactions("CUSTOMER", scope.window, params))

    if kind == "SHOP":
        extras.append(_wallet_transactions("SHOP", scope.window, params))
        commission = " AND ".join(
            [
                "cl.shop_id = %(subject_id)s",
                *window_conditions("cl.created_at", scope.window, params),
            ]
        )
        extras.append(f"""
        (SELECT COALESCE(SUM(cl.shop_share_amount), 0)
           FROM settlement.commission_ledger cl
          WHERE {commission})::bigint AS commission""")

    if kind == "CASHIER":
        paid = " AND ".join(
            [
                "t.paid_by::text = %(subject_id)s",
                "t.paid_at IS NOT NULL",
                *window_conditions("t.paid_at", scope.window, params),
            ]
        )
        extras.append(f"""
        (SELECT COALESCE(SUM(b.payout), 0)
           FROM betting.tickets t
           JOIN betting.bets b ON b.id = t.bet_id
          WHERE {paid})::bigint AS payout_processed""")

    return f"""
    WITH {scoped_cte(scope, params)}
    SELECT {", ".join([BET_FIGURES, *extras])}
    FROM scoped s
    """


def bets_count_sql(scope: BetScope, params: Params) -> str:
    return f"WITH {scoped_cte(scope, params)} SELECT COUNT(*) AS total FROM scoped"


def bets_page_sql(scope: BetScope, params: Params) -> str:
    return f"""
    WITH {scoped_cte(scope, params)}
    SELECT s.* FROM scoped s
    ORDER BY s.placed_at DESC, s.id
    LIMIT %(limit)s OFFSET %(offset)s
    """


#: A leg's recorded result is answered only for a match that is COMPLETED.
BET_LEGS_SQL: Final = """
    SELECT l.id, l.bet_id, l.match_id, l.market_id, l.selection_id, l.league_id,
           l.market_type::text AS market_type, l.selection_code, l.line, l.odds,
           l.odds_version, l.market_label, l.selection_label, l.match_label,
           l.league_name, l.kickoff_at, l.outcome::text AS outcome,
           CASE WHEN m.status::text = 'COMPLETED' THEN l.result END AS result
    FROM betting.bet_selections l
    LEFT JOIN match.matches m ON m.id = l.match_id
    WHERE l.bet_id::text = ANY(%(bet_ids)s)
    ORDER BY l.kickoff_at, l.id
"""

#: The result joins only when the match is COMPLETED: before that instant the
#: row exists in `simulation.match_results` but is not this service's to tell.
MATCH_SQL: Final = """
    SELECT m.id, m.status::text AS status, f.league_id, lg.name AS league_name,
           f.season::text AS season, f.matchday, f.kickoff_at,
           ht.name AS home_name, aw.name AS away_name,
           r.home_goals, r.away_goals, r.winner::text AS winner, r.winning_gap
    FROM match.matches m
    JOIN match.fixtures f ON f.id = m.fixture_id
    JOIN match.leagues lg ON lg.id = f.league_id
    JOIN match.teams ht ON ht.id = f.home_team_id
    JOIN match.teams aw ON aw.id = f.away_team_id
    LEFT JOIN simulation.match_results r
           ON r.match_id = m.id AND m.status::text = 'COMPLETED'
    WHERE m.id = %(match_id)s
"""

#: level -> (leg columns that key it, {label name: expression over a leg}).
_EXPOSURE_LEVELS: Final[dict[str, tuple[tuple[str, ...], dict[str, str]]]] = {
    "match": (
        ("match_id",),
        {
            "match_label": "l.match_label",
            "league_id": "l.league_id::text",
            "league_name": "l.league_name",
            "kickoff_at": "l.kickoff_at",
        },
    ),
    "market": (
        ("match_id", "market_id"),
        {
            "market_type": "l.market_type::text",
            "market_label": "l.market_label",
            "line": "l.line",
        },
    ),
    "selection": (
        ("match_id", "market_id", "selection_id"),
        {
            "selection_code": "l.selection_code",
            "selection_label": "l.selection_label",
        },
    ),
}

_EXPOSURE_FIGURES: Final = """
    COUNT(*) AS bets,
    COALESCE(SUM(p.stake), 0)::bigint AS stake,
    COALESCE(SUM(p.potential_payout), 0)::bigint AS potential_payout,
    COALESCE(SUM(p.potential_payout - p.stake), 0)::bigint AS liability
"""


def _pending_scope(scope: BetScope) -> BetScope:
    return replace(scope, status="PENDING")


def exposure_totals_sql(scope: BetScope, params: Params) -> str:
    return f"""
    WITH {scoped_cte(_pending_scope(scope), params)}
    SELECT {_EXPOSURE_FIGURES} FROM scoped p
    """


def exposure_level_sql(
    level: str, scope: BetScope, params: Params, *, within_matches: bool
) -> str:
    """Pending liability at one level, each bet counted once per key."""
    columns, label_expressions = _EXPOSURE_LEVELS[level]
    group = ", ".join(f"l.{column}" for column in columns)
    keys = ", ".join(f"k.{column}" for column in columns)
    labels = ", ".join(
        f"MIN({expression}) AS {name}"
        for name, expression in label_expressions.items()
    )
    outer_labels = ", ".join(
        f"MIN(k.{name}) AS {name}" for name in label_expressions
    )
    narrowed = " AND l.match_id::text = ANY(%(match_ids)s)" if within_matches else ""
    limit = "" if within_matches else "LIMIT %(limit)s"

    return f"""
    WITH {scoped_cte(_pending_scope(scope), params)},
    keyed AS (
        SELECT {group}, {labels}, l.bet_id
        FROM betting.bet_selections l
        JOIN scoped s ON s.id = l.bet_id
        WHERE TRUE {leg_conditions(scope)} {narrowed}
        GROUP BY {group}, l.bet_id
    )
    SELECT {keys}, {outer_labels}, {_EXPOSURE_FIGURES}
    FROM keyed k
    JOIN scoped p ON p.id = k.bet_id
    GROUP BY {keys}
    ORDER BY liability DESC, {keys}
    {limit}
    """


_SHOP_TICKETS: Final = (
    "FROM betting.tickets t JOIN betting.bets b ON b.id = t.bet_id "
    "WHERE t.shop_id = %(shop_id)s AND "
)

_SALES: Final = (
    "COALESCE(SUM(b.stake) FILTER (WHERE b.status::text <> 'CANCELLED'), 0)::bigint"
)


def _shop_day(column: str) -> str:
    return f"({column} AT TIME ZONE %(tz)s::text)::date"


SHOP_DAYS_SQL: Final = f"""
    WITH {_DAYS_CTE},
    sold AS (
        SELECT {_shop_day("t.created_at")} AS day,
               COUNT(*) AS tickets_sold,
               {_SALES} AS sales,
               COUNT(*) FILTER (WHERE b.status::text = 'PENDING') AS open_tickets
        {_SHOP_TICKETS} {_DAY_BOUNDS.format(column="t.created_at")}
        GROUP BY 1
    ),
    paid AS (
        SELECT {_shop_day("t.paid_at")} AS day,
               COALESCE(SUM(b.payout), 0)::bigint AS payouts
        {_SHOP_TICKETS} {_DAY_BOUNDS.format(column="t.paid_at")}
        GROUP BY 1
    ),
    cancelled AS (
        SELECT {_shop_day("b.cancelled_at")} AS day, COUNT(*) AS cancellations
        {_SHOP_TICKETS} {_DAY_BOUNDS.format(column="b.cancelled_at")}
        GROUP BY 1
    )
    SELECT d.day,
           COALESCE(s.tickets_sold, 0) AS tickets_sold,
           COALESCE(s.sales, 0)::bigint AS sales,
           COALESCE(s.open_tickets, 0) AS open_tickets,
           COALESCE(p.payouts, 0)::bigint AS payouts,
           COALESCE(c.cancellations, 0) AS cancellations
    FROM days d
    LEFT JOIN sold s USING (day)
    LEFT JOIN paid p USING (day)
    LEFT JOIN cancelled c USING (day)
    ORDER BY d.day
"""

SHOP_CASHIERS_SQL: Final = f"""
    WITH sold AS (
        SELECT {_shop_day("t.created_at")} AS day,
               t.cashier_id::text AS cashier_id,
               MIN(t.cashier_name) AS cashier_name,
               COUNT(*) AS tickets_sold,
               {_SALES} AS sales
        {_SHOP_TICKETS} {_DAY_BOUNDS.format(column="t.created_at")}
        GROUP BY 1, 2
    ),
    paid AS (
        SELECT {_shop_day("t.paid_at")} AS day,
               t.paid_by::text AS cashier_id,
               COALESCE(SUM(b.payout), 0)::bigint AS payouts
        {_SHOP_TICKETS} t.paid_by IS NOT NULL
            AND {_DAY_BOUNDS.format(column="t.paid_at")}
        GROUP BY 1, 2
    )
    SELECT day, cashier_id,
           COALESCE(s.cashier_name, ca.display_name, cashier_id) AS cashier_name,
           COALESCE(s.tickets_sold, 0) AS tickets_sold,
           COALESCE(s.sales, 0)::bigint AS sales,
           COALESCE(p.payouts, 0)::bigint AS payouts
    FROM sold s
    FULL JOIN paid p USING (day, cashier_id)
    LEFT JOIN identity.cashiers ca ON ca.id::text = cashier_id
    ORDER BY day, sales DESC, cashier_id
"""

SHOP_LEAGUES_SQL: Final = f"""
    WITH keyed AS (
        SELECT DISTINCT {_shop_day("t.created_at")} AS day, l.league_name, b.id,
               b.stake, b.status::text AS status
        FROM betting.tickets t
        JOIN betting.bets b ON b.id = t.bet_id
        JOIN betting.bet_selections l ON l.bet_id = b.id
        WHERE t.shop_id = %(shop_id)s
          AND {_DAY_BOUNDS.format(column="t.created_at")}
    )
    SELECT k.day, k.league_name,
           COUNT(*) AS tickets_sold,
           COALESCE(SUM(k.stake) FILTER (WHERE k.status <> 'CANCELLED'), 0)::bigint
               AS sales
    FROM keyed k
    GROUP BY 1, 2
    ORDER BY 1, sales DESC, 2
"""
