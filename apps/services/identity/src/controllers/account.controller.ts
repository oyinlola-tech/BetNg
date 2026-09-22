import type {
  AccountDeletion,
  AccountSession,
  BackupCodes,
  TwoFactorEnrollment,
  TwoFactorStatus,
} from "@betng/contracts";
import { parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CancelAccountDeletionCommand,
  ChangePasswordCommand,
  ConfirmTwoFactorCommand,
  DisableTwoFactorCommand,
  EnrollTwoFactorCommand,
  GetAccountDeletionQuery,
  GetTwoFactorStatusQuery,
  ListAccountSessionsQuery,
  RegenerateBackupCodesCommand,
  RequestAccountDeletionCommand,
  RevokeOtherSessionsCommand,
  RevokeSessionCommand,
} from "../services/index.js";
import {
  accountDeletionValidator,
  backupCodesRequestValidator,
  passwordChangeValidator,
  twoFactorConfirmValidator,
  twoFactorDisableValidator,
} from "../validators/index.js";
import { customerCaller, requireIdempotencyKey, uuidParam } from "./request.helper.js";

export interface AccountController {
  readonly twoFactorStatus: (context: HttpRouterContext) => Promise<TwoFactorStatus>;
  readonly enrollTwoFactor: (context: HttpRouterContext) => Promise<TwoFactorEnrollment>;
  readonly confirmTwoFactor: (context: HttpRouterContext) => Promise<BackupCodes>;
  readonly disableTwoFactor: (context: HttpRouterContext) => Promise<TwoFactorStatus>;
  readonly regenerateBackupCodes: (context: HttpRouterContext) => Promise<BackupCodes>;
  readonly changePassword: (context: HttpRouterContext) => Promise<void>;
  readonly listSessions: (context: HttpRouterContext) => Promise<ListDto<AccountSession>>;
  readonly revokeSession: (context: HttpRouterContext) => Promise<void>;
  readonly revokeOtherSessions: (context: HttpRouterContext) => Promise<void>;
  readonly getDeletion: (context: HttpRouterContext) => Promise<AccountDeletion>;
  readonly requestDeletion: (context: HttpRouterContext) => Promise<AccountDeletion>;
  readonly cancelDeletion: (context: HttpRouterContext) => Promise<AccountDeletion>;
}

export function createAccountController(buses: IdentityBuses): AccountController {
  const { commandBus, queryBus } = buses;

  return {
    twoFactorStatus: async (context) =>
      queryBus.execute<GetTwoFactorStatusQuery, TwoFactorStatus>(new GetTwoFactorStatusQuery(customerCaller(context))),

    enrollTwoFactor: async (context) =>
      commandBus.execute<EnrollTwoFactorCommand, TwoFactorEnrollment>(new EnrollTwoFactorCommand(customerCaller(context))),

    confirmTwoFactor: async (context) =>
      commandBus.execute<ConfirmTwoFactorCommand, BackupCodes>(
        new ConfirmTwoFactorCommand(customerCaller(context), parseBody(context.request, twoFactorConfirmValidator)),
      ),

    disableTwoFactor: async (context) =>
      commandBus.execute<DisableTwoFactorCommand, TwoFactorStatus>(
        new DisableTwoFactorCommand(customerCaller(context), parseBody(context.request, twoFactorDisableValidator)),
      ),

    regenerateBackupCodes: async (context) =>
      commandBus.execute<RegenerateBackupCodesCommand, BackupCodes>(
        new RegenerateBackupCodesCommand(customerCaller(context), parseBody(context.request, backupCodesRequestValidator).code),
      ),

    changePassword: async (context) =>
      commandBus.execute<ChangePasswordCommand>(
        new ChangePasswordCommand(customerCaller(context), parseBody(context.request, passwordChangeValidator)),
      ),

    listSessions: async (context) => ({
      items: await queryBus.execute<ListAccountSessionsQuery, readonly AccountSession[]>(
        new ListAccountSessionsQuery(customerCaller(context)),
      ),
    }),

    revokeSession: async (context) =>
      commandBus.execute<RevokeSessionCommand>(new RevokeSessionCommand(customerCaller(context), uuidParam(context, "id"))),

    revokeOtherSessions: async (context) =>
      commandBus.execute<RevokeOtherSessionsCommand>(new RevokeOtherSessionsCommand(customerCaller(context))),

    getDeletion: async (context) =>
      queryBus.execute<GetAccountDeletionQuery, AccountDeletion>(new GetAccountDeletionQuery(customerCaller(context))),

    requestDeletion: async (context) => {
      const idempotencyKey = requireIdempotencyKey(context);

      return commandBus.execute<RequestAccountDeletionCommand, AccountDeletion>(
        new RequestAccountDeletionCommand(customerCaller(context), parseBody(context.request, accountDeletionValidator), idempotencyKey),
      );
    },

    cancelDeletion: async (context) =>
      commandBus.execute<CancelAccountDeletionCommand, AccountDeletion>(new CancelAccountDeletionCommand(customerCaller(context))),
  };
}
