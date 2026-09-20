"""The simulation service's dependency-injection tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import SimulationEngine

#: Resolves the engine that produces match results.
SIMULATION_ENGINE_TOKEN: Token[SimulationEngine] = Token("simulation.engine")

#: Resolves the root logger.
LOGGER_TOKEN: Token[logging.Logger] = Token("simulation.logger")
