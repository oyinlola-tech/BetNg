import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { MatchTiming } from "../configs/index.js";
import type {
  CatalogueRepository,
  Clock,
  IdentityPeer,
  MatchRepository,
  SimulationReader,
} from "../interfaces/index.js";
import type { LifecycleService } from "../services/lifecycle/index.js";

export const LOGGER_TOKEN = createToken<Logger>("match.logger");

export const CATALOGUE_REPOSITORY_TOKEN = createToken<CatalogueRepository>("match.catalogueRepository");

export const MATCH_REPOSITORY_TOKEN = createToken<MatchRepository>("match.repository");

export const SIMULATION_READER_TOKEN = createToken<SimulationReader>("match.simulationReader");

export const LIFECYCLE_SERVICE_TOKEN = createToken<LifecycleService>("match.lifecycleService");

export const IDENTITY_PEER_TOKEN = createToken<IdentityPeer>("match.identityPeer");

export const TIMING_TOKEN = createToken<MatchTiming>("match.timing");

export const CLOCK_TOKEN = createToken<Clock>("match.clock");
