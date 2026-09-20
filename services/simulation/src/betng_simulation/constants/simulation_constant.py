"""The simulation service's CQRS type discriminators.

A message and its handler must agree on one string. Naming them here means the
bus registration and the handler cannot drift apart unnoticed.
"""

from __future__ import annotations

from typing import Final


class SimulationCommand:
    """Command types the simulation service handles."""

    RUN_SIMULATION: Final = "simulation.runSimulation"


class SimulationQuery:
    """Query types the simulation service handles."""

    GET_PROBABILITIES: Final = "simulation.getProbabilities"
