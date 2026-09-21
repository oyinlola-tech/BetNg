import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { ShopController } from "../controllers/index.js";
import { noContent, ok } from "./route.helper.js";

export function registerShopRoutes(router: HttpRouter, controller: ShopController): void {
  router.post(`${API_PREFIX}/shop/auth/login`, ok(controller.login));
  router.post(`${API_PREFIX}/shop/auth/logout`, noContent(controller.logout));
  router.get(`${API_PREFIX}/shop/auth/session`, ok(controller.session));
  router.get(`${API_PREFIX}/shop/cashiers`, ok(controller.listCashiers));
}
