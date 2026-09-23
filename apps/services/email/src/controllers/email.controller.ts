import { createResponseContext } from "@betng/service-kit";
import type { HttpResponseContext, HttpRouterContext } from "@betng/service-kit";
import type { DeliveryService } from "../services/index.js";

export interface EmailController {
  /** A property, not a method: the router is handed this function on its own. */
  readonly webhook: (context: HttpRouterContext) => Promise<HttpResponseContext>;
}

/**
 * `@zudojs/http` leaves the body as the bytes it received and parsing is opt-in, which is what makes a
 * byte-exact signature check possible. Nothing may parse this body before the provider adapter has
 * verified it.
 */
function rawBody(context: HttpRouterContext): Uint8Array {
  const body = context.request.body;

  if (body instanceof Uint8Array) {
    return body;
  }

  return typeof body === "string" ? Buffer.from(body, "utf8") : new Uint8Array();
}

export function createEmailController(delivery: DeliveryService): EmailController {
  return {
    webhook: async (context) => {
      const outcome = await delivery.handleWebhook(rawBody(context), (name) => context.request.getHeader(name));

      // A duplicate or an event about a message we do not know is still a 2xx: the provider should
      // stop retrying. Only a failed signature answers 401, from the rejected-webhook error.
      return createResponseContext({ status: 200 }).json({ received: true, outcome });
    },
  };
}
