import { ErrorCodes } from "@betng/contracts";
import { serviceUnavailable } from "@betng/service-kit";
import type { RouteHandler } from "@betng/service-kit";
import { getDatabaseErrorKind } from "@zudojs/database";

/**
 * Answers a lost database with `DATABASE_UNAVAILABLE` rather than a bare 500.
 *
 * Only connection and timeout failures are translated; anything else is a
 * fault and stays one. The client is told nothing about the database itself.
 */
export function withDatabaseFailure(handler: RouteHandler): RouteHandler {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      const kind = getDatabaseErrorKind(error);

      if (kind === "connection" || kind === "timeout") {
        throw serviceUnavailable("The service cannot reach its records right now.", {
          code: ErrorCodes.DATABASE_UNAVAILABLE,
          expose: true,
          cause: error,
        });
      }

      throw error;
    }
  };
}
