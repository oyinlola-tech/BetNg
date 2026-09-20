"""The simulation engine implementation.

This phase ships :class:`UnbuiltSimulationEngine`, which satisfies the engine
protocol and refuses every call with a 501.

That is deliberate. The foundation's job is to fix the contract, the route and
the boundary so the rest of the platform can be built against them; the
mathematics is a later phase. An engine that returned a plausible-looking
random score would be worse than one that refuses, because callers would start
depending on numbers that mean nothing.
"""

from __future__ import annotations

from ..dtos import OutcomeProbabilities, SimulationRequest, SimulationResult
from ..errors import SimulationEngineNotBuiltError
from ..interfaces import SimulationEngine


class UnbuiltSimulationEngine(SimulationEngine):
    async def simulate(self, request: SimulationRequest) -> SimulationResult:
        raise SimulationEngineNotBuiltError("a match result")

    async def probabilities(
        self, home_strength: float, away_strength: float
    ) -> OutcomeProbabilities:
        raise SimulationEngineNotBuiltError("outcome probabilities")


def create_simulation_engine() -> SimulationEngine:
    return UnbuiltSimulationEngine()
