from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import (
    AUDIT_RECORDER_TOKEN,
    EVENT_PUBLISHER_TOKEN,
    EXPOSURE_READER_TOKEN,
    LOGGER_TOKEN,
    MATCH_DIRECTORY_TOKEN,
    ODDS_REPOSITORY_TOKEN,
    PROBABILITY_MODEL_TOKEN,
)
from .commands import (
    ApplyMarketActionHandler,
    PublishMarketsHandler,
    RecalculateOddsHandler,
    SetMatchMarketsStatusHandler,
    UpdatePricingConfigurationHandler,
)
from .queries import (
    GetBulkOddsHandler,
    GetMatchOddsHandler,
    GetPricingConfigurationHandler,
    ListAdminOddsHandler,
    ListMarketSnapshotsHandler,
)


def register_odds_service(
    container: Container, command_bus: CommandBus, query_bus: QueryBus
) -> None:
    repository = container.resolve(ODDS_REPOSITORY_TOKEN)
    probability_model = container.resolve(PROBABILITY_MODEL_TOKEN)
    match_directory = container.resolve(MATCH_DIRECTORY_TOKEN)
    exposure_reader = container.resolve(EXPOSURE_READER_TOKEN)
    audit_recorder = container.resolve(AUDIT_RECORDER_TOKEN)
    event_publisher = container.resolve(EVENT_PUBLISHER_TOKEN)
    logger = container.resolve(LOGGER_TOKEN)

    command_bus.register(
        PublishMarketsHandler(repository, probability_model, match_directory, logger)
    )
    command_bus.register(SetMatchMarketsStatusHandler(repository, logger))
    command_bus.register(
        ApplyMarketActionHandler(
            repository,
            match_directory,
            exposure_reader,
            audit_recorder,
            event_publisher,
            logger,
        )
    )
    command_bus.register(
        UpdatePricingConfigurationHandler(repository, audit_recorder, logger)
    )
    command_bus.register(
        RecalculateOddsHandler(
            repository, probability_model, match_directory, event_publisher, logger
        )
    )

    query_bus.register(GetMatchOddsHandler(repository))
    query_bus.register(GetBulkOddsHandler(repository))
    query_bus.register(
        ListAdminOddsHandler(repository, match_directory, exposure_reader)
    )
    query_bus.register(GetPricingConfigurationHandler(repository))
    query_bus.register(ListMarketSnapshotsHandler(repository))
