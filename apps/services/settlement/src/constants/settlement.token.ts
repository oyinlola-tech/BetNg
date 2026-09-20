/**
 * The settlement service's dependency-injection tokens.
 */

import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { SettlementRepository } from "../interfaces/index.js";

/** Resolves the settlement repository. */
export const SETTLEMENT_REPOSITORY_TOKEN = createToken<SettlementRepository>(
  "settlement.repository",
);

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("settlement.logger");
