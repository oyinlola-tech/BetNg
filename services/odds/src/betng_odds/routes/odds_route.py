"""Odds service routes.

These are the service's secondary, REST door — for debugging, manual
inspection and analytics. The primary API is RPC; see `procedures`.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..controllers import OddsController
from ..dtos import CalculateOddsRequest, MatchOdds

API_PREFIX = "/api/v1"


def create_odds_router(controller: OddsController) -> APIRouter:
    router = APIRouter(prefix=API_PREFIX, tags=["odds"])

    @router.get(
        "/matches/{match_id}/odds",
        response_model=MatchOdds,
        summary="Read a match's current markets",
        description=(
            "Returns every market currently priced for a match. This is the "
            "one odds endpoint the gateway forwards to, so a browsing client "
            "can read prices without an RPC client."
        ),
    )
    async def get_match_odds(match_id: str) -> MatchOdds:
        return await controller.get_match_odds(match_id)

    @router.post(
        "/matches/{match_id}/odds",
        response_model=MatchOdds,
        summary="Price a match's markets",
        description=(
            "Prices a match from supplied probabilities. Exposed over REST "
            "for manual inspection during development; the platform calls "
            "`odds.calculateOdds` over RPC."
        ),
    )
    async def generate_odds(
        match_id: str, request: CalculateOddsRequest
    ) -> MatchOdds:
        return await controller.generate_odds(request)

    return router
