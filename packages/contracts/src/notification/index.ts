/**
 * @betng/contracts/notification
 *
 * In-app notifications and the call that marks them read.
 */

export {
  markNotificationsReadRequestSchema,
  notificationKindSchema,
  notificationSchema,
} from "./notification.type.js";
export type {
  MarkNotificationsReadRequest,
  Notification,
  NotificationKind,
} from "./notification.type.js";
