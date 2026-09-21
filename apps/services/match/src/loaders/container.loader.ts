import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { MatchTiming } from "../configs/index.js";
import {
  CATALOGUE_REPOSITORY_TOKEN,
  CLOCK_TOKEN,
  IDENTITY_PEER_TOKEN,
  LIFECYCLE_SERVICE_TOKEN,
  LOGGER_TOKEN,
  MATCH_REPOSITORY_TOKEN,
  SIMULATION_READER_TOKEN,
  TIMING_TOKEN,
} from "../constants/index.js";
import type {
  CatalogueRepository,
  Clock,
  IdentityPeer,
  MatchRepository,
  SimulationReader,
} from "../interfaces/index.js";
import type { LifecycleService } from "../services/index.js";

export interface ContainerLoaderConfig {
  readonly catalogue: CatalogueRepository;
  readonly matches: MatchRepository;
  readonly simulation: SimulationReader;
  readonly lifecycle: LifecycleService;
  readonly identity: IdentityPeer;
  readonly timing: MatchTiming;
  readonly clock: Clock;
  readonly logger: Logger;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(CATALOGUE_REPOSITORY_TOKEN, config.catalogue);
  container.registerValue(MATCH_REPOSITORY_TOKEN, config.matches);
  container.registerValue(SIMULATION_READER_TOKEN, config.simulation);
  container.registerValue(LIFECYCLE_SERVICE_TOKEN, config.lifecycle);
  container.registerValue(IDENTITY_PEER_TOKEN, config.identity);
  container.registerValue(TIMING_TOKEN, config.timing);
  container.registerValue(CLOCK_TOKEN, config.clock);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
