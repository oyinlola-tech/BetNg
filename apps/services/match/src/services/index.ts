export { registerMatchService } from "./match/index.js";
export type {
  CommandActor,
  HandlerDependencies,
  MatchServiceConfig,
} from "./match/index.js";
export { createLifecycleService, SYSTEM_ACTOR } from "./lifecycle/index.js";
export type {
  LifecycleActor,
  LifecycleDependencies,
  LifecycleService,
} from "./lifecycle/index.js";
