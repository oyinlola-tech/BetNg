/**
 * @betng/contracts/simulation
 *
 * The wire format of the Python simulation service: match simulation and
 * the outcome probabilities the odds service prices from.
 */

export {
  simulatedEventSchema,
  simulationRequestSchema,
  simulationResultSchema,
  simulationTeamSchema,
} from "./simulation.type.js";
export type {
  SimulatedEvent,
  SimulationRequest,
  SimulationResult,
  SimulationTeam,
} from "./simulation.type.js";

export {
  outcomeProbabilitiesSchema,
  probabilityRequestSchema,
} from "./probability.type.js";
export type {
  OutcomeProbabilities,
  ProbabilityRequest,
} from "./probability.type.js";
