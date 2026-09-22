import { API_PREFIX } from "@betng/contracts";
import { created, json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { PaymentsController } from "../controllers/payments.controller.js";

function describe(description: string): { readonly metadata: { readonly description: string } } {
  return { metadata: { description } };
}

export function registerPaymentRoutes(router: HttpRouter, controller: PaymentsController): void {
  const p = `${API_PREFIX}/payments`;

  router.post(`${p}/deposit/initiate`, created(controller.initiateDeposit), describe("Customer. Starts a deposit with the active provider. Idempotency-Key required; limits and KYC tier checked first."));
  router.post(`${p}/deposit/verify`, json(controller.verifyDeposit), describe("Customer. Re-queries the provider; credits the ledger once on confirmation."));
  router.get(`${p}/history`, json(controller.history), describe("Customer. The caller's payments, newest first, paged."));
  router.post(`${p}/withdraw/quote`, json(controller.quoteWithdrawal), describe("Customer. Fee and net amount for a withdrawal."));
  router.post(`${p}/withdraw/request`, created(controller.requestWithdrawal), describe("Customer. Debits the wallet and sends a bank transfer. Idempotency-Key required."));
  router.get(`${p}/withdraw/status/:reference`, json(controller.withdrawalStatus), describe("Customer. One of the caller's withdrawals."));
  router.get(`${p}/banks`, json(controller.banks), describe("Customer. Banks the active provider can pay out to."));
  router.post(`${p}/bank-accounts/verify`, json(controller.verifyBankAccount), describe("Customer. Name enquiry; the account number is stored encrypted."));
  router.post(`${p}/bank-accounts`, created(controller.saveBankAccount), describe("Customer. Saves an account from a verification."));
  router.get(`${p}/bank-accounts`, json(controller.listBankAccounts), describe("Customer. The caller's bank accounts, masked."));
  router.post(`${p}/bank-accounts/:id/default`, json(controller.defaultBankAccount), describe("Customer. Makes one account the default."));
  router.delete(`${p}/bank-accounts/:id`, controller.deleteBankAccount, describe("Customer. Removes an account with no withdrawal in flight."));
  router.post(`${p}/webhook/paystack`, controller.webhook("paystack"), describe("Paystack webhook; x-paystack-signature over the raw body."));
  router.post(`${p}/webhook/flutterwave`, controller.webhook("flutterwave"), describe("Flutterwave webhook; verif-hash header."));
  router.post(`${p}/webhook/bachs`, controller.webhook("bachs"), describe("Bachs webhook; refused until the provider is configured."));

  router.post(`${API_PREFIX}/account/statements`, created(controller.requestStatement), describe("Customer. A CSV or PDF statement from the ledger."));
  router.get(`${API_PREFIX}/account/statements/:id`, json(controller.getStatement), describe("Customer. A statement job and its short-lived download link."));

  router.get(`${API_PREFIX}/shop/shifts/current`, json(controller.currentShift), describe("Cashier (shifts:operate). The caller's open shift."));
  router.post(`${API_PREFIX}/shop/shifts`, created(controller.openShift), describe("Cashier (shifts:operate). Opens a shift. Idempotency-Key required."));
  router.post(`${API_PREFIX}/shop/shifts/current/cash`, json(controller.moveCash), describe("Cashier (cash:move). Cash in or out of the drawer."));
  router.post(`${API_PREFIX}/shop/shifts/:id/close`, json(controller.closeShift), describe("Cashier (shifts:operate). Closes a shift with a PIN and a counted drawer."));
  router.get(`${API_PREFIX}/shop/shifts`, json(controller.listShifts), describe("Cashier. Own shifts for a day; every shop shift with reports:read."));

  router.get(`${API_PREFIX}/admin/payments/overview`, json(controller.adminOverview), describe("Admin (payments:read). Today's payment figures and provider health."));
  router.get(`${API_PREFIX}/admin/payments`, json(controller.adminPayments), describe("Admin (payments:read). Every payment, filtered and paged."));
  router.post(`${API_PREFIX}/admin/payments/withdrawals/:reference/review`, json(controller.reviewWithdrawal), describe("Admin (payments:write). Approves or rejects a held withdrawal; audited."));
}
