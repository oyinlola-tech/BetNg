export const API_PREFIX = "/api/v1";

export const IDENTITY_PROCEDURE = Object.freeze({
  AUTHENTICATE: "identity.authenticate",
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  RECORD_AUDIT: "identity.recordAudit",
  NOTIFY: "identity.notify",
  LIMITS_CHECK: "limits.check",
  KYC_STATUS: "kyc.status",
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
  UPDATE_CUSTOMER_PROFILE: "identity.updateCustomerProfile",
  ADMIN_UPDATE_CUSTOMER: "identity.adminUpdateCustomer",
  ADMIN_SEND_PASSWORD_RESET: "identity.adminSendPasswordReset",
  CREATE_SHOP: "identity.createShop",
  UPDATE_SHOP: "identity.updateShop",
  SET_SHOP_STATUS: "identity.setShopStatus",
  CREATE_CASHIER: "identity.createCashier",
  SET_CASHIER_STATUS: "identity.setCashierStatus",
  RESET_CASHIER_CREDENTIALS: "identity.resetCashierCredentials",
  RECORD_AUDIT: "identity.recordAudit",
  UPDATE_SETTINGS: "identity.updateSettings",
  NOTIFY_CUSTOMER: "identity.notifyCustomer",
  MARK_NOTIFICATIONS_READ: "identity.markNotificationsRead",
  COMPLETE_TWO_FACTOR_LOGIN: "identity.completeTwoFactorLogin",
  ENROLL_TWO_FACTOR: "identity.enrollTwoFactor",
  CONFIRM_TWO_FACTOR: "identity.confirmTwoFactor",
  DISABLE_TWO_FACTOR: "identity.disableTwoFactor",
  REGENERATE_BACKUP_CODES: "identity.regenerateBackupCodes",
  RESET_PASSWORD: "identity.resetPassword",
  CHANGE_PASSWORD: "identity.changePassword",
  REFRESH_SESSION: "identity.refreshSession",
  REVOKE_SESSION: "identity.revokeSession",
  REVOKE_OTHER_SESSIONS: "identity.revokeOtherSessions",
  REQUEST_ACCOUNT_DELETION: "identity.requestAccountDeletion",
  CANCEL_ACCOUNT_DELETION: "identity.cancelAccountDeletion",
  UPDATE_CHANNEL_PREFERENCES: "identity.updateChannelPreferences",
  REGISTER_PUSH_DEVICE: "identity.registerPushDevice",
  REMOVE_PUSH_DEVICE: "identity.removePushDevice",
  ISSUE_KYC_UPLOAD: "identity.issueKycUpload",
  SUBMIT_KYC_DOCUMENT: "identity.submitKycDocument",
  VERIFY_IDENTITY_NUMBER: "identity.verifyIdentityNumber",
  REVIEW_KYC: "identity.reviewKyc",
  PREVIEW_KYC_DOCUMENT: "identity.previewKycDocument",
  SET_LIMIT: "identity.setLimit",
  REMOVE_LIMIT: "identity.removeLimit",
  SELF_EXCLUDE: "identity.selfExclude",
  CANCEL_SELF_EXCLUSION: "identity.cancelSelfExclusion",
  CHECK_LIMITS: "identity.checkLimits",
});

export const IDENTITY_QUERY = Object.freeze({
  GET_CUSTOMER_PROFILE: "identity.getCustomerProfile",
  GET_ACCOUNT_PROFILE: "identity.getAccountProfile",
  GET_SHOP_SESSION: "identity.getShopSession",
  LIST_OWN_SHOP_CASHIERS: "identity.listOwnShopCashiers",
  GET_ADMIN_SESSION: "identity.getAdminSession",
  LIST_CUSTOMERS: "identity.listCustomers",
  LIST_SHOPS: "identity.listShops",
  GET_SHOP: "identity.getShop",
  LIST_SHOP_CASHIERS: "identity.listShopCashiers",
  LIST_AUDIT_LOGS: "identity.listAuditLogs",
  GET_SETTINGS: "identity.getSettings",
  LIST_NOTIFICATIONS: "identity.listNotifications",
  GET_TWO_FACTOR_STATUS: "identity.getTwoFactorStatus",
  LIST_ACCOUNT_SESSIONS: "identity.listAccountSessions",
  GET_ACCOUNT_DELETION: "identity.getAccountDeletion",
  GET_CHANNEL_PREFERENCES: "identity.getChannelPreferences",
  LIST_PUSH_DEVICES: "identity.listPushDevices",
  GET_KYC_OVERVIEW: "identity.getKycOverview",
  LIST_KYC_DOCUMENTS: "identity.listKycDocuments",
  GET_KYC_STATUS: "identity.getKycStatus",
  LIST_KYC_QUEUE: "identity.listKycQueue",
  GET_LIMITS_SUMMARY: "identity.getLimitsSummary",
  LIST_LIMIT_HISTORY: "identity.listLimitHistory",
  LIST_RESPONSIBLE_GAMING: "identity.listResponsibleGaming",
});

export const AUDIT_ACTION = Object.freeze({
  ADMIN_LOGIN: "admin_login",
  ADMIN_LOGIN_FAILED: "admin_login_failed",
  ADMIN_LOGOUT: "admin_logout",
  ADMIN_TOTP_ENROLLED: "admin_totp_enrolled",
  CUSTOMER_STATUS_CHANGED: "customer_status_changed",
  CUSTOMER_PROFILE_UPDATED: "customer_profile_updated",
  CUSTOMER_PASSWORD_RESET_SENT: "customer_password_reset_sent",
  SHOP_CREATED: "shop_created",
  SHOP_UPDATED: "shop_updated",
  SHOP_STATUS_CHANGED: "shop_status_changed",
  CASHIER_CREATED: "cashier_created",
  CASHIER_STATUS_CHANGED: "cashier_status_changed",
  CASHIER_CREDENTIALS_RESET: "cashier_credentials_reset",
  SETTINGS_CHANGED: "platform_settings_changed",
  PASSWORD_CHANGED: "customer_password_changed",
  PASSWORD_RESET: "customer_password_reset",
  TWO_FACTOR_ENABLED: "customer_two_factor_enabled",
  TWO_FACTOR_DISABLED: "customer_two_factor_disabled",
  BACKUP_CODES_REGENERATED: "customer_backup_codes_regenerated",
  SESSIONS_REVOKED: "customer_sessions_revoked",
  DELETION_REQUESTED: "account_deletion_requested",
  DELETION_CANCELLED: "account_deletion_cancelled",
  CUSTOMER_DELETED: "customer_deleted",
  KYC_DOCUMENT_SUBMITTED: "kyc_document_submitted",
  KYC_IDENTITY_CHECKED: "kyc_identity_checked",
  KYC_REVIEWED: "kyc_reviewed",
  KYC_DOCUMENT_VIEWED: "kyc_document_viewed",
  LIMIT_CHANGED: "responsible_gaming_limit_changed",
  SELF_EXCLUDED: "self_exclusion_started",
  SELF_EXCLUSION_CANCELLED: "self_exclusion_cancelled",
});

export const AUDIT_ENTITY = Object.freeze({
  ADMIN_USER: "admin_user",
  CUSTOMER: "customer",
  SHOP: "shop",
  CASHIER: "cashier",
  SETTINGS: "platform_settings",
  KYC_DOCUMENT: "kyc_document",
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
  OPERATOR_PASSWORD_MIN_LENGTH: 12,
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

export const NOTIFICATION = Object.freeze({
  TITLE_MAX: 120,
  BODY_MAX: 240,
  DATA_MAX_BYTES: 4096,
  DEDUPE_KEY_MAX: 120,
  LIST_DEFAULT: 50,
  LIST_MAX: 100,
  MARK_READ_MAX_IDS: 100,
});

export const ACCOUNT_SECURITY = Object.freeze({
  TOTP_SECRET_BYTES: 20,
  TOTP_ISSUER: "BetNG",
  ENROLLMENT_TTL_MS: 10 * 60_000,
  MAX_ENROLLMENT_ATTEMPTS: 5,
  CHALLENGE_TTL_MS: 5 * 60_000,
  MAX_CHALLENGE_ATTEMPTS: 5,
  BACKUP_CODE_COUNT: 10,
  PASSWORD_RESET_TTL_MS: 15 * 60_000,
  MAX_PASSWORD_RESET_ATTEMPTS: 5,
  PASSWORD_RESET_INTERVAL_MS: 60_000,
  PASSWORD_HISTORY_DEPTH: 5,
  KNOWN_CLIENT_WINDOW_MS: 90 * 24 * 3_600_000,
  DELETION_BATCH: 50,
});

export const DELIVERY = Object.freeze({
  MAX_PUSH_DEVICES: 20,
});

export const KYC = Object.freeze({
  UPLOAD_TTL_SECONDS: 300,
  SUBMIT_GRACE_MS: 60 * 60_000,
  PREVIEW_TTL_SECONDS: 60,
  MAX_UPLOADS_PER_HOUR: 10,
  MAX_IDENTITY_CHECKS_PER_DAY: 5,
  QUEUE_PAGE_SIZE_DEFAULT: 20,
});

/** Daily deposit/withdrawal allowance (kobo) per verification tier, as the platform states it to customers and to wallet. */
export const KYC_TIER_LIMITS = Object.freeze({
  TIER_0: { dailyDeposit: 5_000_000, dailyWithdrawal: 0 },
  TIER_1: { dailyDeposit: 20_000_000, dailyWithdrawal: 10_000_000 },
  TIER_2: { dailyDeposit: 100_000_000, dailyWithdrawal: 50_000_000 },
  TIER_3: { dailyDeposit: 500_000_000, dailyWithdrawal: 250_000_000 },
});

export const RESPONSIBLE_GAMING = Object.freeze({
  COOLING_OFF_MS: 24 * 3_600_000,
  MIN_MONEY_LIMIT: 100,
  MAX_MONEY_LIMIT: 100_000_000_000,
  MIN_SESSION_MINUTES: 15,
  MAX_SESSION_MINUTES: 1440,
  HISTORY_LIMIT: 200,
  FLAG_LOOKBACK_MS: 30 * 24 * 3_600_000,
  LONG_SESSION_MS: 6 * 3_600_000,
  ACTIVE_WITHIN_MS: 15 * 60_000,
});

export const MAINTENANCE = Object.freeze({
  INTERVAL_MS: 3_600_000,
  THROTTLE_RETENTION_MS: 24 * 3_600_000,
  SESSION_RETENTION_MS: 30 * 24 * 3_600_000,
  VERIFICATION_RETENTION_MS: 7 * 24 * 3_600_000,
  NOTIFICATION_RETENTION_MS: 30 * 24 * 3_600_000,
  COMPLIANCE_INTERVAL_MS: 60_000,
  EVICTION_INTERVAL_MS: 15_000,
  CHALLENGE_RETENTION_MS: 24 * 3_600_000,
  UPLOAD_RETENTION_MS: 7 * 24 * 3_600_000,
});
