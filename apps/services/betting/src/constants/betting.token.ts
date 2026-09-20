/**
 * The betting service's dependency-injection tokens.
 */

import { createToken } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import type { BetRepository, RiskGate } from "../interfaces/index.js";

/** Resolves the bet repository. */
export const BET_REPOSITORY_TOKEN =
  createToken<BetRepository>("betting.repository");

/** Resolves the service-wide event bus. */
export const EVENT_BUS_TOKEN = createToken<EventBus>("betting.eventBus");

/** Resolves the gate betting consults before accepting a slip. */
export const RISK_GATE_TOKEN = createToken<RiskGate>("betting.riskGate");

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("betting.logger");
