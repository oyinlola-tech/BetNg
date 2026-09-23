import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { ShopApplicationController } from "../controllers/index.js";
import { made, ok } from "./route.helper.js";

/**
 * Three public routes and three admin ones. The public routes are rate-limited at the gateway and take no
 * session: anyone may apply, and a status lookup needs the reference *and* the verified address.
 */
export function registerShopApplicationRoutes(router: HttpRouter, controller: ShopApplicationController): void {
  router.post(`${API_PREFIX}/shop-applications`, made(controller.submit));
  router.post(`${API_PREFIX}/shop-applications/:reference/verify`, ok(controller.verifyEmail));
  router.get(`${API_PREFIX}/shop-applications/:reference/status`, ok(controller.status));

  const admin = `${API_PREFIX}/admin`;

  router.get(`${admin}/shop-applications`, ok(controller.queue));
  router.get(`${admin}/shop-applications/:id`, ok(controller.get));
  router.post(`${admin}/shop-applications/:id/review`, ok(controller.review));

  // A shop owner staffing their own shop. The shop comes from the session on every one of these.
  const shop = `${API_PREFIX}/shop`;

  router.post(`${shop}/cashiers`, made(controller.createCashier));
  router.post(`${shop}/cashiers/:id/status`, ok(controller.setCashierStatus));
  router.post(`${shop}/cashiers/:id/reset-credentials`, ok(controller.resetCashierCredentials));
}
