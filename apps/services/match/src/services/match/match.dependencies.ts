import type { Logger } from "@betng/service-kit";
import type { MatchTiming } from "../../configs/index.js";
import type {
  CatalogueRepository,
  Clock,
  IdentityPeer,
  MatchRepository,
  SimulationReader,
} from "../../interfaces/index.js";
import type { LifecycleActor, LifecycleService } from "../lifecycle/index.js";

export interface HandlerDependencies {
  readonly catalogue: CatalogueRepository;
  readonly matches: MatchRepository;
  readonly simulation: SimulationReader;
  readonly lifecycle: LifecycleService;
  readonly identity: IdentityPeer;
  readonly timing: MatchTiming;
  readonly clock: Clock;
  readonly logger: Logger;
}

/** Who asked for a write, taken from the gateway's actor headers and never from the body. */
export interface CommandActor extends LifecycleActor {
  readonly requestId: string;
}
