"""The simulation service's engine contract.

The handlers are written against this protocol, never against a concrete
engine, so the engine that lands in the next phase drops in behind it without
touching the HTTP layer, the routes or the tests above it.

Note what the protocol does *not* accept: no stakes, no liabilities, no bet
identifiers. A simulation is a function of the teams and the fixture alone.
That absence is what makes "betting cannot influence the result" checkable
rather than merely stated — there is no parameter through which it could.
"""

from __future__ import annotations

from typing import Protocol

from ..dtos import OutcomeProbabilities, SimulationRequest, SimulationResult


class SimulationEngine(Protocol):
    """Produces a match result and the probabilities behind it."""

    async def simulate(self, request: SimulationRequest) -> SimulationResult:
        """Play one virtual match and return its result and timeline."""
        ...

    async def probabilities(
        self, home_strength: float, away_strength: float
    ) -> OutcomeProbabilities:
        """Return the home/draw/away probabilities for a pairing."""
        ...
