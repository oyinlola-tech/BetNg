import { Buffer } from "node:buffer";
import { ErrorCodes } from "@betng/contracts";
import {
  createResponseContext,
  getRequestId,
  notFound,
  parseBody,
  parseQuery,
  requireActor,
  requireParam,
  unprocessableEntity,
} from "@betng/service-kit";
import type { Actor, HttpResponseContext, HttpRouterContext, RouteHandler } from "@betng/service-kit";
import { IDEMPOTENCY_KEY_HEADER } from "../constants/index.js";
import { PAYMENT_PERMISSION, SHOP_PERMISSION } from "../constants/payments.constant.js";
import { paymentErrors } from "../errors/index.js";
import type { BankAccountsService } from "../services/payments/bankAccounts.service.js";
import type { PaymentsService, WebhookRoute } from "../services/payments/payments.service.js";
import type { ShiftsService, CashierContext } from "../services/shifts/shifts.service.js";
import type { StatementsService } from "../services/statements/statements.service.js";
import { utcDayRange, utcToday } from "../utils/index.js";
import {
  adminPaymentsQuerySchema,
  bankAccountVerifySchema,
  cashMovementSchema,
  floatTransferSchema,
  closeShiftSchema,
  depositInitiateSchema,
  depositVerifySchema,
  historyQuerySchema,
  idempotencyHeaderSchema,
  openShiftSchema,
  referenceSchema,
  reviewSchema,
  saveBankAccountSchema,
  shiftListQuerySchema,
  statementSchema,
  uuidSchema,
  withdrawalSchema,
} from "../validators/index.js";

type Handler<T> = (context: HttpRouterContext) => Promise<T>;

export interface PaymentsControllerOptions {
  readonly payments: PaymentsService;
  readonly bankAccounts: BankAccountsService;
  readonly statements: StatementsService;
  readonly shifts: ShiftsService;
}

export interface PaymentsController {
  readonly initiateDeposit: Handler<unknown>;
  readonly verifyDeposit: Handler<unknown>;
  readonly history: Handler<unknown>;
  readonly quoteWithdrawal: Handler<unknown>;
  readonly requestWithdrawal: Handler<unknown>;
  readonly withdrawalStatus: Handler<unknown>;
  readonly banks: Handler<unknown>;
  readonly verifyBankAccount: Handler<unknown>;
  readonly saveBankAccount: Handler<unknown>;
  readonly listBankAccounts: Handler<unknown>;
  readonly defaultBankAccount: Handler<unknown>;
  readonly deleteBankAccount: RouteHandler;
  readonly webhook: (route: WebhookRoute) => RouteHandler;
  readonly requestStatement: Handler<unknown>;
  readonly getStatement: Handler<unknown>;
  readonly currentShift: Handler<unknown>;
  readonly openShift: Handler<unknown>;
  readonly moveCash: Handler<unknown>;
  readonly closeShift: Handler<unknown>;
  readonly listShifts: Handler<unknown>;
  readonly transferFloat: Handler<unknown>;
  readonly listTransfers: Handler<unknown>;
  readonly adminOverview: Handler<unknown>;
  readonly adminPayments: Handler<unknown>;
  readonly reviewWithdrawal: Handler<unknown>;
}

function customer(context: HttpRouterContext): Actor {
  const actor = requireActor(context.request, { kind: "CUSTOMER" });

  if (!uuidSchema.safeParse(actor.id).success) {
    throw paymentErrors.forbidden();
  }

  return actor;
}

function cashier(context: HttpRouterContext, permission: string): CashierContext {
  const actor = requireActor(context.request, { kind: "CASHIER", permission });

  if (!uuidSchema.safeParse(actor.id).success || !uuidSchema.safeParse(actor.shopId).success || actor.shopId === undefined) {
    throw paymentErrors.forbidden();
  }

  return { cashierId: actor.id, shopId: actor.shopId, actor };
}

function idempotencyKey(context: HttpRouterContext): string {
  const parsed = idempotencyHeaderSchema.safeParse(context.request.getHeader(IDEMPOTENCY_KEY_HEADER));

  if (!parsed.success) {
    throw unprocessableEntity("An idempotency-key header (8-100 characters) is required.", {
      code: ErrorCodes.VALIDATION_FAILED,
      expose: true,
      details: [{ path: "idempotency-key", message: "Required: letters, digits and . _ : - only." }],
    });
  }

  return parsed.data;
}

function uuidParam(context: HttpRouterContext, name: string, what: string): string {
  const value = requireParam(context.params, name);

  if (!uuidSchema.safeParse(value).success) {
    throw notFound(`No ${what} matches that id.`, { code: ErrorCodes.NOT_FOUND, expose: true });
  }

  return value;
}

function referenceParam(context: HttpRouterContext): string {
  const value = requireParam(context.params, "reference");

  if (!referenceSchema.safeParse(value).success) {
    throw paymentErrors.notFound();
  }

  return value;
}

function rawBody(context: HttpRouterContext): Uint8Array {
  const body = context.request.body;

  if (body instanceof Uint8Array) {
    return body;
  }

  return typeof body === "string" ? Buffer.from(body, "utf8") : new Uint8Array();
}

export function createPaymentsController(options: PaymentsControllerOptions): PaymentsController {
  const { payments, bankAccounts, statements, shifts } = options;

  return {
    initiateDeposit: async (context) => {
      const actor = customer(context);
      const key = idempotencyKey(context);

      return payments.initiateDeposit(actor.id, parseBody(context.request, depositInitiateSchema), key, getRequestId(context.request));
    },

    verifyDeposit: async (context) => {
      const actor = customer(context);
      const { reference } = parseBody(context.request, depositVerifySchema);

      return payments.verifyDeposit(actor.id, reference, getRequestId(context.request));
    },

    history: async (context) => payments.history(customer(context).id, parseQuery(context.query, historyQuerySchema)),

    quoteWithdrawal: async (context) => payments.quote(customer(context).id, parseBody(context.request, withdrawalSchema)),

    requestWithdrawal: async (context) => {
      const actor = customer(context);
      const key = idempotencyKey(context);

      return payments.requestWithdrawal(actor.id, parseBody(context.request, withdrawalSchema), key, getRequestId(context.request));
    },

    withdrawalStatus: async (context) => payments.withdrawalStatus(customer(context).id, referenceParam(context)),

    banks: async (context) => {
      customer(context);

      return { items: await bankAccounts.banks() };
    },

    verifyBankAccount: async (context) => bankAccounts.verify(customer(context).id, parseBody(context.request, bankAccountVerifySchema)),

    saveBankAccount: async (context) => bankAccounts.save(customer(context).id, parseBody(context.request, saveBankAccountSchema)),

    listBankAccounts: async (context) => bankAccounts.list(customer(context).id),

    defaultBankAccount: async (context) => bankAccounts.makeDefault(customer(context).id, uuidParam(context, "id", "bank account")),

    deleteBankAccount: async (context): Promise<HttpResponseContext> => {
      await bankAccounts.remove(customer(context).id, uuidParam(context, "id", "bank account"));

      return createResponseContext({ status: 204 });
    },

    webhook: (route) => async (context) => {
      const outcome = await payments.handleWebhook(
        route,
        rawBody(context),
        (name) => context.request.getHeader(name),
        getRequestId(context.request),
      );

      return createResponseContext({ status: 200 }).json({ received: true, outcome });
    },

    requestStatement: async (context) =>
      statements.request(customer(context).id, parseBody(context.request, statementSchema), getRequestId(context.request)),

    getStatement: async (context) => statements.get(customer(context).id, uuidParam(context, "id", "statement")),

    currentShift: async (context) => shifts.current(cashier(context, SHOP_PERMISSION.SHIFTS_OPERATE)),

    openShift: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.SHIFTS_OPERATE);
      const key = idempotencyKey(context);

      return shifts.open(cashierContext, parseBody(context.request, openShiftSchema), key);
    },

    moveCash: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.CASH_MOVE);
      const key = idempotencyKey(context);

      return shifts.moveCash(cashierContext, parseBody(context.request, cashMovementSchema), key, getRequestId(context.request));
    },

    closeShift: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.SHIFTS_OPERATE);
      const id = uuidParam(context, "id", "shift");
      const key = idempotencyKey(context);

      return shifts.close(cashierContext, id, parseBody(context.request, closeShiftSchema), key, getRequestId(context.request));
    },

    transferFloat: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.CASH_TRANSFER);
      const key = idempotencyKey(context);

      return shifts.transferFloat(
        cashierContext,
        parseBody(context.request, floatTransferSchema),
        key,
        getRequestId(context.request),
      );
    },

    listTransfers: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.REPORTS_READ);
      const { date } = parseQuery(context.query, shiftListQuerySchema);
      const range = date === undefined ? utcToday() : utcDayRange(date);

      if (range === undefined) {
        throw paymentErrors.invalid("That is not a calendar date.");
      }

      return { items: await shifts.listTransfers(cashierContext, range) };
    },

    listShifts: async (context) => {
      const cashierContext = cashier(context, SHOP_PERMISSION.SHIFTS_OPERATE);
      const { date } = parseQuery(context.query, shiftListQuerySchema);
      const range = date === undefined ? utcToday() : utcDayRange(date);

      if (range === undefined) {
        throw paymentErrors.invalid("That is not a calendar date.");
      }

      return shifts.list(cashierContext, range);
    },

    adminOverview: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: PAYMENT_PERMISSION.READ });

      return payments.overview();
    },

    adminPayments: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: PAYMENT_PERMISSION.READ });

      const query = parseQuery(context.query, adminPaymentsQuerySchema);

      return payments.adminPage({ ...query, search: query.search === "" ? undefined : query.search });
    },

    reviewWithdrawal: async (context) => {
      const actor = requireActor(context.request, { kind: "ADMIN", permission: PAYMENT_PERMISSION.WRITE });
      const reference = referenceParam(context);
      const review = parseBody(context.request, reviewSchema);

      return payments.review(reference, review.decision, review.reason.trim(), actor, getRequestId(context.request));
    },
  };
}
