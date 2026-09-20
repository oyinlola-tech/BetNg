import { createToken } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import type { BetRepository, RiskGate } from "../interfaces/index.js";

export const BET_REPOSITORY_TOKEN =
  createToken<BetRepository>("betting.repository");

export const EVENT_BUS_TOKEN = createToken<EventBus>("betting.eventBus");

export const RISK_GATE_TOKEN = createToken<RiskGate>("betting.riskGate");

export const LOGGER_TOKEN = createToken<Logger>("betting.logger");
