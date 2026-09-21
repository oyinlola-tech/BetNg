"""Cross-schema reads of the shared read model (docs/architecture.md §8).

The odds login can read every schema and write only its own. These classes
issue SELECTs against the contract columns of ``match`` and ``betting`` and
nothing else. Neither feeds pricing: the match directory supplies labels and
the betting window, the exposure reader supplies the admin console's figures.
"""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Pool

from ..interfaces import ExposureReader, MatchDirectory
from ..types import MatchInfo, SelectionExposure
from ..utils import transaction


@dataclass(frozen=True)
class PostgresMatchDirectory(MatchDirectory):
    """Matches, their teams and league, from the ``match`` schema."""

    pool: Pool

    async def find(self, match_ids: list[str]) -> dict[str, MatchInfo]:
        """Return the known matches among ``match_ids``, keyed by id."""
        if not match_ids:
            return {}

        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                """
                SELECT m.id AS match_id, m.lifecycle::text AS lifecycle,
                       f.betting_closes_at,
                       home.name AS home_name, home.short_name AS home_short_name,
                       away.name AS away_name, away.short_name AS away_short_name,
                       league.name AS league_name
                  FROM match.matches m
                  JOIN match.fixtures f ON f.id = m.fixture_id
                  JOIN match.teams home ON home.id = f.home_team_id
                  JOIN match.teams away ON away.id = f.away_team_id
                  JOIN match.leagues league ON league.id = f.league_id
                 WHERE m.id = ANY(%s::uuid[])
                """,
                (match_ids,),
            )

            return {
                str(row["match_id"]): MatchInfo(
                    match_id=str(row["match_id"]),
                    home_name=row["home_name"],
                    away_name=row["away_name"],
                    home_short_name=row["home_short_name"],
                    away_short_name=row["away_short_name"],
                    league_name=row["league_name"],
                    lifecycle=row["lifecycle"],
                    betting_closes_at=row["betting_closes_at"],
                )
                for row in await cursor.fetchall()
            }


@dataclass(frozen=True)
class PostgresExposureReader(ExposureReader):
    """Pending stake and liability per selection, from the ``betting`` schema."""

    pool: Pool

    async def by_selection(self, market_ids: list[str]) -> dict[str, SelectionExposure]:
        """Return pending stake and liability per selection id."""
        if not market_ids:
            return {}

        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                """
                SELECT leg.selection_id,
                       COALESCE(SUM(bet.stake), 0)::bigint AS stake,
                       GREATEST(
                           COALESCE(SUM(bet.potential_payout - bet.stake), 0), 0
                       )::bigint AS liability
                  FROM betting.bet_selections leg
                  JOIN betting.bets bet ON bet.id = leg.bet_id
                 WHERE bet.status::text = 'PENDING'
                   AND leg.market_id = ANY(%s::uuid[])
                 GROUP BY leg.selection_id
                """,
                (market_ids,),
            )

            return {
                str(row["selection_id"]): SelectionExposure(
                    stake=int(row["stake"]), liability=int(row["liability"])
                )
                for row in await cursor.fetchall()
            }
