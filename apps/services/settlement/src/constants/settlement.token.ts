import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { SettlementRepository } from "../interfaces/index.js";

export const SETTLEMENT_REPOSITORY_TOKEN = createToken<SettlementRepository>(
  "settlement.repository",
);

export const LOGGER_TOKEN = createToken<Logger>("settlement.logger");
