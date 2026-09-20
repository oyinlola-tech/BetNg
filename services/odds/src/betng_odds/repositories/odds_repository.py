"""The odds pricer implementation.

This phase ships :class:`UnbuiltOddsPricer`, which satisfies the pricer
protocol and refuses every call with a 501.

That is deliberate. The foundation's job is to fix the contract, the procedure
and the boundary so betting and the gateway can be built against them; the
pricing model is a later phase. A pricer that returned plausible-looking odds
would be worse than one that refuses, because the betting service would start
accepting bets at prices nobody computed.
"""

from __future__ import annotations

from ..dtos import MatchOdds, OutcomeProbabilities
from ..errors import OddsPricingNotBuiltError
from ..interfaces import OddsPricer


class UnbuiltOddsPricer(OddsPricer):
    """A pricer that refuses, pending the real model."""

    async def price(
        self, match_id: str, probabilities: OutcomeProbabilities
    ) -> MatchOdds:
        """Refuse to price a match.

        Raises:
            OddsPricingNotBuiltError: Always.
        """
        raise OddsPricingNotBuiltError("priced markets")

    async def current(self, match_id: str) -> MatchOdds:
        """Refuse to return a match's current markets.

        Raises:
            OddsPricingNotBuiltError: Always.
        """
        raise OddsPricingNotBuiltError("a match's current markets")


def create_odds_pricer() -> OddsPricer:
    """Create the pricer this phase ships.

    Returns:
        The pricer registered in the container.
    """
    return UnbuiltOddsPricer()
