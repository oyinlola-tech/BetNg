export const API_PREFIX = "/api/v1";

export const IDENTITY_PROCEDURE = Object.freeze({
  AUTHENTICATE: "identity.authenticate",
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  RECORD_AUDIT: "identity.recordAudit",
});

export const IDENTITY_COMMAND = Object.freeze({
  REGISTER_CUSTOMER: "identity.registerCustomer",
  VERIFY_EMAIL: "identity.verifyEmail",
  RESEND_VERIFICATION: "identity.resendVerification",
  LOGIN_CUSTOMER: "identity.loginCustomer",
  REQUEST_PASSWORD_RESET: "identity.requestPasswordReset",
  LOGIN_CASHIER: "identity.loginCashier",
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  LOGIN_ADMIN: "identity.loginAdmin",
  LOGOUT: "identity.logout",
  AUTHENTICATE: "identity.authenticate",
  SET_CUSTOMER_STATUS: "identity.setCustomerStatus",
  CREATE_SHOP: "identity.createShop",
  UPDATE_SHOP: "identity.updateShop",
  SET_SHOP_STATUS: "identity.setShopStatus",
  CREATE_CASHIER: "identity.createCashier",
  SET_CASHIER_STATUS: "identity.setCashierStatus",
  RESET_CASHIER_CREDENTIALS: "identity.resetCashierCredentials",
  RECORD_AUDIT: "identity.recordAudit",
  UPDATE_SETTINGS: "identity.updateSettings",
});

export const IDENTITY_QUERY = Object.freeze({
  GET_CUSTOMER_PROFILE: "identity.getCustomerProfile",
  GET_SHOP_SESSION: "identity.getShopSession",
  LIST_OWN_SHOP_CASHIERS: "identity.listOwnShopCashiers",
  GET_ADMIN_SESSION: "identity.getAdminSession",
  LIST_CUSTOMERS: "identity.listCustomers",
  LIST_SHOPS: "identity.listShops",
  GET_SHOP: "identity.getShop",
  LIST_SHOP_CASHIERS: "identity.listShopCashiers",
  LIST_AUDIT_LOGS: "identity.listAuditLogs",
  GET_SETTINGS: "identity.getSettings",
});

/** Identity's own audit actions (`docs/architecture.md` §9). */
export const AUDIT_ACTION = Object.freeze({
  ADMIN_LOGIN: "admin_login",
  ADMIN_LOGIN_FAILED: "admin_login_failed",
  ADMIN_LOGOUT: "admin_logout",
  CUSTOMER_STATUS_CHANGED: "customer_status_changed",
  SHOP_CREATED: "shop_created",
  SHOP_UPDATED: "shop_updated",
  SHOP_STATUS_CHANGED: "shop_status_changed",
  CASHIER_CREATED: "cashier_created",
  CASHIER_STATUS_CHANGED: "cashier_status_changed",
  CASHIER_CREDENTIALS_RESET: "cashier_credentials_reset",
  SETTINGS_CHANGED: "platform_settings_changed",
});

export const AUDIT_ENTITY = Object.freeze({
  ADMIN_USER: "admin_user",
  CUSTOMER: "customer",
  SHOP: "shop",
  CASHIER: "cashier",
  SETTINGS: "platform_settings",
});

export const SYSTEM_ACTOR = Object.freeze({ id: "system", role: "SYSTEM", name: "System" });

export const UNKNOWN_ACTOR = Object.freeze({ id: "unknown", role: "UNKNOWN", name: "Unknown" });

export const SECURITY = Object.freeze({
  SESSION_TOKEN_BYTES: 32,
  MAX_LOGIN_FAILURES: 8,
  LOCKOUT_MS: 15 * 60_000,
  VERIFICATION_CODE_DIGITS: 6,
  VERIFICATION_TTL_MS: 15 * 60_000,
  MAX_VERIFICATION_ATTEMPTS: 5,
  VERIFICATION_RESEND_INTERVAL_MS: 60_000,
  PASSWORD_RESET_TTL_MS: 30 * 60_000,
  PASSWORD_RESET_RESPONSE_MS: 400,
  SESSION_TOUCH_INTERVAL_MS: 60_000,
  TEMPORARY_CREDENTIALS_TTL_MS: 24 * 3_600_000,
  TEMPORARY_PASSWORD_LENGTH: 14,
  TEMPORARY_PIN_DIGITS: 6,
  AUDIT_SNAPSHOT_MAX_BYTES: 16 * 1024,
  AUDIT_SNAPSHOT_MAX_DEPTH: 8,
});

export const LIST_LIMIT = Object.freeze({
  CUSTOMERS: 200,
  SHOPS: 500,
  CASHIERS: 200,
  AUDIT_PAGE_SIZE_DEFAULT: 25,
});

export const MAINTENANCE = Object.freeze({
  INTERVAL_MS: 3_600_000,
  THROTTLE_RETENTION_MS: 24 * 3_600_000,
  SESSION_RETENTION_MS: 30 * 24 * 3_600_000,
  VERIFICATION_RETENTION_MS: 7 * 24 * 3_600_000,
});
