import { getDatabaseErrorKind } from "@zudojs/database";
import { ErrorCodes } from "@betng/contracts";
import { serviceUnavailable } from "@betng/service-kit";
import type { RouteHandler } from "@betng/service-kit";

export function guardDatabase(handler: RouteHandler): RouteHandler {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      const kind = getDatabaseErrorKind(error);

      if (kind === "connection" || kind === "timeout") {
        throw serviceUnavailable("The database is not available. Try again shortly.", {
          code: ErrorCodes.DATABASE_UNAVAILABLE,
          expose: true,
          cause: error,
        });
      }

      throw error;
    }
  };
}
