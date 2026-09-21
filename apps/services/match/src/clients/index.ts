import type { ServiceConfig } from "@betng/service-kit";
import type { Peers } from "../interfaces/index.js";
import { createEventClient } from "./event.client.js";
import { createIdentityClient } from "./identity.client.js";
import { createOddsClient } from "./odds.client.js";
import { createRiskClient } from "./risk.client.js";
import { createSettlementClient } from "./settlement.client.js";
import { createSimulationClient } from "./simulation.client.js";

export { EVENT_PROCEDURE } from "./event.client.js";
export { IDENTITY_PROCEDURE } from "./identity.client.js";
export { ODDS_PROCEDURE } from "./odds.client.js";
export { RISK_PROCEDURE } from "./risk.client.js";
export { SETTLEMENT_PROCEDURE } from "./settlement.client.js";
export { SIMULATION_PROCEDURE } from "./simulation.client.js";

export interface RpcPeers extends Peers {
  readonly close: () => Promise<void>;
}

export function createPeers(services: ServiceConfig["services"]): RpcPeers {
  const odds = createOddsClient(services.odds);
  const simulation = createSimulationClient(services.simulation);
  const risk = createRiskClient(services.risk);
  const settlement = createSettlementClient(services.settlement);
  const event = createEventClient(services.event);
  const identity = createIdentityClient(services.identity);

  return {
    odds,
    simulation,
    risk,
    settlement,
    event,
    identity,
    close: async () => {
      await Promise.all(
        [odds, simulation, risk, settlement, event, identity].map(
          async (peer) => peer.raw.close(),
        ),
      );
    },
  };
}
