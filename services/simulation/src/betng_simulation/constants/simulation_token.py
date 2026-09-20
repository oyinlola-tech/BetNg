from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import SimulationEngine

SIMULATION_ENGINE_TOKEN: Token[SimulationEngine] = Token("simulation.engine")

LOGGER_TOKEN: Token[logging.Logger] = Token("simulation.logger")
