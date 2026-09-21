import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type { NotificationController } from "../controllers/index.js";
import { noContent, ok } from "./route.helper.js";

export function registerNotificationRoutes(router: HttpRouter, controller: NotificationController): void {
  router.get(`${API_PREFIX}/users/:id/notifications`, ok(controller.list));
  router.post(`${API_PREFIX}/users/:id/notifications/read`, noContent(controller.markRead));
}
