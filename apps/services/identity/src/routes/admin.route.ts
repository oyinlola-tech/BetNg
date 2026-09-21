import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { AdminController } from "../controllers/index.js";
import { made, noContent, ok } from "./route.helper.js";

export function registerAdminRoutes(router: HttpRouter, controller: AdminController): void {
  const admin = `${API_PREFIX}/admin`;

  router.post(`${admin}/auth/login`, ok(controller.login));
  router.post(`${admin}/auth/logout`, noContent(controller.logout));
  router.get(`${admin}/auth/session`, ok(controller.session));

  router.get(`${admin}/users`, ok(controller.listCustomers));
  router.post(`${admin}/users/:id/status`, ok(controller.setCustomerStatus));

  router.get(`${admin}/shops`, ok(controller.listShops));
  router.post(`${admin}/shops`, made(controller.createShop));
  router.get(`${admin}/shops/:id`, ok(controller.getShop));
  router.patch(`${admin}/shops/:id`, ok(controller.updateShop));
  router.post(`${admin}/shops/:id/status`, ok(controller.setShopStatus));

  router.get(`${admin}/shops/:id/cashiers`, ok(controller.listCashiers));
  router.post(`${admin}/shops/:id/cashiers`, made(controller.createCashier));
  router.post(`${admin}/shops/:id/cashiers/:cashierId/status`, ok(controller.setCashierStatus));
  router.post(
    `${admin}/shops/:id/cashiers/:cashierId/reset-credentials`,
    ok(controller.resetCashierCredentials),
  );

  router.get(`${admin}/audit`, ok(controller.listAuditLogs));

  router.get(`${admin}/settings`, ok(controller.getSettings));
  router.patch(`${admin}/settings`, ok(controller.updateSettings));
}
