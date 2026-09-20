from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import LOGGER_TOKEN, SIMULATION_ENGINE_TOKEN
from ..interfaces import SimulationEngine


def load_container(
    engine: SimulationEngine, logger: logging.Logger
) -> Container:
    container = Container()

    container.register_value(SIMULATION_ENGINE_TOKEN, engine)
    container.register_value(LOGGER_TOKEN, logger)

    return container
