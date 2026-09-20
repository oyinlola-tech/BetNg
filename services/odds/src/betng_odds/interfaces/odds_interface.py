"""The odds service's pricing contract.

The handlers are written against this protocol, never against a concrete
pricer, so the pricing model that lands in a later phase drops in behind it.

The split that matters: the simulation service owns *probability*, the odds
service owns *price*. A pricer receives probabilities and applies a margin; it
has no way to decide how likely an outcome is, so a change to the book's
margin can never quietly become a change to the match.
"""

from __future__ import annotations

from typing import Protocol

from ..dtos import MatchOdds, OutcomeProbabilities


class OddsPricer(Protocol):
    """Turns outcome probabilities into priced markets."""

    async def price(
        self, match_id: str, probabilities: OutcomeProbabilities
    ) -> MatchOdds:
        """Build the markets for a match from its probabilities."""
        ...

    async def current(self, match_id: str) -> MatchOdds:
        """Return the markets currently priced for a match."""
        ...
