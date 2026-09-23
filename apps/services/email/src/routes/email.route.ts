import { API_PREFIX } from "@betng/contracts";
import type { HttpRouter } from "@betng/service-kit";
import type { EmailController } from "../controllers/index.js";

function describe(description: string): { readonly metadata: { readonly description: string } } {
  return { metadata: { description } };
}

export function registerEmailRoutes(router: HttpRouter, controller: EmailController): void {
  router.post(
    `${API_PREFIX}/email/webhook/sendbyte`,
    controller.webhook,
    describe("SendByte delivery webhook; sendbyte-signature is verified over the raw body before it is parsed."),
  );
}
