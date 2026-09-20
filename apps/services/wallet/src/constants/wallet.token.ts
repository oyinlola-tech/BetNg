/**
 * The wallet service's dependency-injection tokens.
 *
 * Tokens created with `createToken` are unique symbols, so two packages
 * cannot collide on a string key, and resolving one is type-safe without a
 * cast at the call site.
 */

import { createToken } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import type { WalletRepository } from "../interfaces/index.js";

/** Resolves the wallet repository. */
export const WALLET_REPOSITORY_TOKEN =
  createToken<WalletRepository>("wallet.repository");

/** Resolves the service-wide event bus. */
export const EVENT_BUS_TOKEN = createToken<EventBus>("wallet.eventBus");

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("wallet.logger");
