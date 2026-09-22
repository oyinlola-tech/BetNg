import { createRPCProcedure, RPCError, RPCServer, RPCValidationError } from "@zudojs/rpc";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { Logger } from "@betng/service-kit";
import { IDENTITY_PROCEDURE, SYSTEM_ACTOR } from "../constants/index.js";
import type {
  AuditRecordedDto,
  AuthenticatedActorDto,
  KycStatusDto,
  LimitsCheckDto,
  NotifiedDto,
  PinVerificationDto,
} from "../dtos/index.js";
import {
  AuthenticateCommand,
  CheckLimitsCommand,
  GetKycStatusQuery,
  NotifyCustomerCommand,
  RecordAuditCommand,
  VerifyCashierPinCommand,
} from "../services/index.js";
import {
  authenticatePayloadValidator,
  kycStatusPayloadValidator,
  limitsCheckPayloadValidator,
  notifyPayloadValidator,
  recordAuditPayloadValidator,
  verifyCashierPinPayloadValidator,
} from "../validators/index.js";

function payload<T>(schema: ValidationSchema<T>, input: unknown, procedure: string): T {
  const result = validate(schema, input);

  if (!result.success) {
    throw new RPCValidationError(
      "The payload failed validation.",
      result.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      procedure,
    );
  }

  return result.data;
}

interface Refusal {
  readonly code: string;
  readonly message: string;
  readonly expose: boolean;
}

function isRefusal(error: unknown): error is Refusal {
  const candidate = error as Partial<Refusal> | null;

  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.code === "string" &&
    candidate.expose === true
  );
}

/** Domain refusals travel with their contract code (`UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `RATE_LIMITED`). */
async function withContractCodes<T>(procedure: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isRefusal(error)) {
      throw new RPCError(error.message, { code: error.code, expose: true, procedureName: procedure });
    }

    throw error;
  }
}

/** `/rpc` is not proxied by the gateway; its callers are other BetNG services. */
export function createIdentityRpcServer(commandBus: CommandBus, queryBus: QueryBus, logger: Logger): RPCServer {
  const server = new RPCServer(undefined, undefined, {
    onInternalError: (error, requestId) => {
      logger.error("RPC procedure failed", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  server.register(
    createRPCProcedure<unknown, AuthenticatedActorDto>(IDENTITY_PROCEDURE.AUTHENTICATE, async (input) => {
      const { token } = payload(authenticatePayloadValidator, input, IDENTITY_PROCEDURE.AUTHENTICATE);

      return withContractCodes(IDENTITY_PROCEDURE.AUTHENTICATE, async () =>
        commandBus.execute<AuthenticateCommand, AuthenticatedActorDto>(new AuthenticateCommand(token)),
      );
    }),
  );

  server.register(
    createRPCProcedure<unknown, PinVerificationDto>(
      IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN,
      async (input) => {
        const { cashierId, pin } = payload(
          verifyCashierPinPayloadValidator,
          input,
          IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN,
        );

        return withContractCodes(IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN, async () =>
          commandBus.execute<VerifyCashierPinCommand, PinVerificationDto>(
            new VerifyCashierPinCommand(cashierId, pin),
          ),
        );
      },
    ),
  );

  server.register(
    createRPCProcedure<unknown, AuditRecordedDto>(
      IDENTITY_PROCEDURE.RECORD_AUDIT,
      async (input, context) => {
        const entry = payload(recordAuditPayloadValidator, input, IDENTITY_PROCEDURE.RECORD_AUDIT);
        const metadataRequestId = context.metadata.requestId;

        return commandBus.execute<RecordAuditCommand, AuditRecordedDto>(
          new RecordAuditCommand({
            actorId: entry.actorId,
            actorRole: entry.actorRole,
            actorName:
              entry.actorName ?? (entry.actorId === SYSTEM_ACTOR.id ? SYSTEM_ACTOR.name : entry.actorId),
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            before: entry.before,
            after: entry.after,
            reason: entry.reason ?? undefined,
            severity: entry.severity ?? "INFO",
            requestId:
              entry.requestId ??
              (typeof metadataRequestId === "string" ? metadataRequestId.slice(0, 64) : context.request.id.slice(0, 64)),
          }),
        );
      },
    ),
  );

  server.register(
    createRPCProcedure<unknown, NotifiedDto>(IDENTITY_PROCEDURE.NOTIFY, async (input) => {
      const notification = payload(notifyPayloadValidator, input, IDENTITY_PROCEDURE.NOTIFY);

      return withContractCodes(IDENTITY_PROCEDURE.NOTIFY, async () =>
        commandBus.execute<NotifyCustomerCommand, NotifiedDto>(
          new NotifyCustomerCommand({
            customerId: notification.customerId,
            kind: notification.kind,
            title: notification.title,
            body: notification.body,
            data: notification.data ?? undefined,
            dedupeKey: notification.dedupeKey ?? undefined,
          }),
        ),
      );
    }),
  );

  // A caller that cannot get an answer here must refuse the money action (fail closed); this never answers "allowed" on error.
  server.register(
    createRPCProcedure<unknown, LimitsCheckDto>(IDENTITY_PROCEDURE.LIMITS_CHECK, async (input) => {
      const { userId, action, amount } = payload(limitsCheckPayloadValidator, input, IDENTITY_PROCEDURE.LIMITS_CHECK);

      return withContractCodes(IDENTITY_PROCEDURE.LIMITS_CHECK, async () =>
        commandBus.execute<CheckLimitsCommand, LimitsCheckDto>(new CheckLimitsCommand(userId, action, amount)),
      );
    }),
  );

  server.register(
    createRPCProcedure<unknown, KycStatusDto>(IDENTITY_PROCEDURE.KYC_STATUS, async (input) => {
      const { userId } = payload(kycStatusPayloadValidator, input, IDENTITY_PROCEDURE.KYC_STATUS);

      return withContractCodes(IDENTITY_PROCEDURE.KYC_STATUS, async () =>
        queryBus.execute<GetKycStatusQuery, KycStatusDto>(new GetKycStatusQuery(userId)),
      );
    }),
  );

  return server;
}
