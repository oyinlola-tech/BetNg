/**
 * The match service's dependency-injection tokens.
 *
 * Tokens created with `createToken` are unique symbols, so two packages
 * cannot collide on a string key, and resolving one is type-safe without a
 * cast at the call site.
 */

import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { MatchRepository } from "../interfaces/index.js";

/** Resolves the match repository. */
export const MATCH_REPOSITORY_TOKEN =
  createToken<MatchRepository>("match.repository");

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("match.logger");
