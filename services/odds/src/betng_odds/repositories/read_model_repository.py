from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Pool

from ..interfaces import ExposureReader, MatchDirectory
from ..types import MatchInfo, SelectionExposure
from ..utils import transaction


@dataclass(frozen=True)
class PostgresMatchDirectory(MatchDirectory):
    pool: Pool

    async def find(self, match_ids: list[str]) -> dict[str, MatchInfo]:
        if not match_ids:
            return {}

        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                """
                SELECT m.id AS match_id, m.lifecycle::text AS lifecycle,
                       f.betting_closes_at,
                       home.name AS home_name, home.short_name AS home_short_name,
                       away.name AS away_name, away.short_name AS away_short_name,
                       league.name AS league_name,
                       m.home_strength AS home_strength,
                       m.away_strength AS away_strength
                  FROM match.matches m
                  JOIN match.fixtures f ON f.id = m.fixture_id
                  JOIN match.teams home ON home.id = f.home_team_id
                  JOIN match.teams away ON away.id = f.away_team_id
                  JOIN match.leagues league ON league.id = f.league_id
                 WHERE m.id = ANY(%s::uuid[])
                """,
                (match_ids,),
            )

            results: dict[str, MatchInfo] = {}
            for row in await cursor.fetchall():
                home_strength = None
                away_strength = None

                raw_home = row["home_strength"]
                raw_away = row["away_strength"]

                if raw_home is not None:
                    if isinstance(raw_home, str):
                        import json
                        raw_home = json.loads(raw_home)
                    home_strength = {
                        "attack": float(raw_home.get("attack", 50)),
                        "defence": float(raw_home.get("defence", 50)),
                        "midfield": float(raw_home.get("midfield", 50)),
                        "goalkeeping": float(raw_home.get("goalkeeping", 50)),
                        "pace": float(raw_home.get("pace", 50)),
                        "finishing": float(raw_home.get("finishing", 50)),
                        "possession": float(raw_home.get("possession", 50)),
                        "form": float(raw_home.get("form", 0)),
                        "home_advantage": float(raw_home.get("homeAdvantage", 55)),
                    }

                if raw_away is not None:
                    if isinstance(raw_away, str):
                        import json
                        raw_away = json.loads(raw_away)
                    away_strength = {
                        "attack": float(raw_away.get("attack", 50)),
                        "defence": float(raw_away.get("defence", 50)),
                        "midfield": float(raw_away.get("midfield", 50)),
                        "goalkeeping": float(raw_away.get("goalkeeping", 50)),
                        "pace": float(raw_away.get("pace", 50)),
                        "finishing": float(raw_away.get("finishing", 50)),
                        "possession": float(raw_away.get("possession", 50)),
                        "form": float(raw_away.get("form", 0)),
                        "home_advantage": float(raw_away.get("homeAdvantage", 55)),
                    }

                results[str(row["match_id"])] = MatchInfo(
                    match_id=str(row["match_id"]),
                    home_name=row["home_name"],
                    away_name=row["away_name"],
                    home_short_name=row["home_short_name"],
                    away_short_name=row["away_short_name"],
                    league_name=row["league_name"],
                    lifecycle=row["lifecycle"],
                    betting_closes_at=row["betting_closes_at"],
                    home_strength=home_strength,
                    away_strength=away_strength,
                )

            return results


@dataclass(frozen=True)
class PostgresExposureReader(ExposureReader):
    pool: Pool

    async def by_selection(self, market_ids: list[str]) -> dict[str, SelectionExposure]:
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
