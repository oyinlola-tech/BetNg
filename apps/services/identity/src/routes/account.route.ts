import type { HttpRouter } from "@betng/service-kit";
import { API_PREFIX } from "../constants/index.js";
import type {
  AccountController,
  ChannelsController,
  ComplianceController,
  KycController,
  LimitsController,
} from "../controllers/index.js";
import { noContent, ok } from "./route.helper.js";

export function registerAccountRoutes(router: HttpRouter, controller: AccountController): void {
  const account = `${API_PREFIX}/account`;

  router.patch(`${account}/profile`, ok(controller.updateProfile));
  router.get(`${account}/export`, ok(controller.exportData));
  router.get(`${account}/2fa`, ok(controller.twoFactorStatus));
  router.post(`${account}/2fa/enroll`, ok(controller.enrollTwoFactor));
  router.post(`${account}/2fa/confirm`, ok(controller.confirmTwoFactor));
  router.post(`${account}/2fa/disable`, ok(controller.disableTwoFactor));
  router.post(`${account}/2fa/backup-codes`, ok(controller.regenerateBackupCodes));
  router.put(`${account}/password`, noContent(controller.changePassword));
  router.get(`${account}/sessions`, ok(controller.listSessions));
  router.delete(`${account}/sessions`, noContent(controller.revokeOtherSessions));
  router.delete(`${account}/sessions/:id`, noContent(controller.revokeSession));
  router.get(`${account}/deletion`, ok(controller.getDeletion));
  router.post(`${account}/deletion`, ok(controller.requestDeletion));
  router.delete(`${account}/deletion`, ok(controller.cancelDeletion));
}

export function registerChannelRoutes(router: HttpRouter, controller: ChannelsController): void {
  const notifications = `${API_PREFIX}/notifications`;

  router.get(`${notifications}/preferences`, ok(controller.getPreferences));
  router.put(`${notifications}/preferences`, ok(controller.updatePreferences));
  router.get(`${notifications}/push/devices`, ok(controller.listDevices));
  router.post(`${notifications}/push/register`, ok(controller.registerDevice));
  router.delete(`${notifications}/push/devices/:id`, noContent(controller.removeDevice));
}

export function registerKycRoutes(router: HttpRouter, controller: KycController): void {
  const kyc = `${API_PREFIX}/kyc`;

  router.get(`${kyc}/status`, ok(controller.status));
  router.get(`${kyc}/documents`, ok(controller.documents));
  router.post(`${kyc}/documents/uploads`, ok(controller.upload));
  router.post(`${kyc}/documents`, ok(controller.submit));
  router.post(`${kyc}/verify/bvn`, ok(controller.verifyBvn));
  router.post(`${kyc}/verify/nin`, ok(controller.verifyNin));
}

export function registerLimitRoutes(router: HttpRouter, controller: LimitsController): void {
  const limits = `${API_PREFIX}/limits`;

  router.get(`${limits}/summary`, ok(controller.summary));
  router.put(limits, ok(controller.setLimit));
  router.get(`${limits}/history`, ok(controller.history));
  router.post(`${limits}/self-exclude`, ok(controller.selfExclude));
  router.delete(`${limits}/self-exclude`, ok(controller.cancelSelfExclusion));
  router.delete(`${limits}/:kind`, ok(controller.removeLimit));
}

export function registerComplianceRoutes(router: HttpRouter, controller: ComplianceController): void {
  const admin = `${API_PREFIX}/admin`;

  router.get(`${admin}/kyc/pending`, ok(controller.kycQueue));
  router.post(`${admin}/kyc/review/:userId`, ok(controller.reviewKyc));
  router.get(`${admin}/kyc/documents/:id/preview`, ok(controller.previewDocument));
  router.get(`${admin}/responsible-gaming`, ok(controller.responsibleGaming));
}
