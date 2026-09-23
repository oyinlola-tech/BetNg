import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { AdminController } from "../controllers/index.js";
import { made, noContent, ok } from "./route.helper.js";

export function registerAdminRoutes(router: HttpRouter, controller: AdminController): void {
  const admin = `${API_PREFIX}/admin`;

  router.post(`${admin}/auth/login`, ok(controller.login));
  router.post(`${admin}/auth/logout`, noContent(controller.logout));
  router.get(`${admin}/auth/session`, ok(controller.session));
  // Public, both steps. One proves the one-time password and hands back an authenticator to enrol; the
  // other proves a code from it, takes a chosen password and signs the caller in.
  router.post(`${admin}/auth/activate/start`, ok(controller.startActivation));
  router.post(`${admin}/auth/activate`, ok(controller.activate));

  router.get(`${admin}/admins`, ok(controller.listAdmins));
  router.post(`${admin}/admins`, made(controller.createAdmin));
  router.patch(`${admin}/admins/:id`, ok(controller.updateAdmin));
  router.post(`${admin}/admins/:id/status`, ok(controller.setAdminStatus));
  router.post(`${admin}/admins/:id/reset-credentials`, ok(controller.resetAdminCredentials));

  router.get(`${admin}/users`, ok(controller.listCustomers));
  router.patch(`${admin}/users/:id`, ok(controller.updateCustomer));
  router.post(`${admin}/users/:id/status`, ok(controller.setCustomerStatus));
  router.post(`${admin}/users/:id/password-reset`, noContent(controller.sendPasswordReset));

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
