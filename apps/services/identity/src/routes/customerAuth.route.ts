import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { CustomerAuthController } from "../controllers/index.js";
import { noContent, ok } from "./route.helper.js";

export function registerCustomerAuthRoutes(router: HttpRouter, controller: CustomerAuthController): void {
  router.post(`${API_PREFIX}/auth/register`, ok(controller.register));
  router.post(`${API_PREFIX}/auth/verify`, ok(controller.verify));
  router.post(`${API_PREFIX}/auth/verify/resend`, noContent(controller.resendVerification));
  router.post(`${API_PREFIX}/auth/login`, ok(controller.login));
  router.post(`${API_PREFIX}/auth/logout`, noContent(controller.logout));
  router.get(`${API_PREFIX}/auth/me`, ok(controller.me));
  router.post(`${API_PREFIX}/auth/password/forgot`, noContent(controller.forgotPassword));
}
