import { ErrorCodes } from "@betng/contracts";
import { serviceUnavailable } from "@betng/service-kit";
import type { RouteHandler } from "@betng/service-kit";
import { getDatabaseErrorKind } from "@zudojs/database";

// Connection and timeout failures answer DATABASE_UNAVAILABLE; anything else stays a fault.
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
