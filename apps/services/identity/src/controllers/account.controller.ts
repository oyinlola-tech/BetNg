import type {
  AccountDeletion,
  AccountSession,
  BackupCodes,
  ChannelPreferences,
  CustomerProfile,
  KycDocument,
  KycOverview,
  LimitHistoryEntry,
  LimitsSummary,
  Notification,
  PushDevice,
  TwoFactorEnrollment,
  TwoFactorStatus,
} from "@betng/contracts";
import { parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { NOTIFICATION } from "../constants/index.js";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CancelAccountDeletionCommand,
  ChangePasswordCommand,
  ConfirmTwoFactorCommand,
  DisableTwoFactorCommand,
  EnrollTwoFactorCommand,
  GetAccountDeletionQuery,
  GetAccountProfileQuery,
  GetChannelPreferencesQuery,
  GetKycOverviewQuery,
  GetLimitsSummaryQuery,
  GetTwoFactorStatusQuery,
  ListAccountSessionsQuery,
  ListKycDocumentsQuery,
  ListLimitHistoryQuery,
  ListNotificationsQuery,
  ListPushDevicesQuery,
  RegenerateBackupCodesCommand,
  RequestAccountDeletionCommand,
  RevokeOtherSessionsCommand,
  RevokeSessionCommand,
  UpdateCustomerProfileCommand,
} from "../services/index.js";
import {
  accountDeletionValidator,
  backupCodesRequestValidator,
  passwordChangeValidator,
  twoFactorConfirmValidator,
  twoFactorDisableValidator,
  updateProfileValidator,
} from "../validators/index.js";
import { customerCaller, requireIdempotencyKey, uuidParam } from "./request.helper.js";

/** Identity's own records about the caller. Wallet and bet history live in account statements (POST /account/statements). */
export interface AccountExport {
  readonly format: "betng.account-export.v1";
  readonly exportedAt: string;
  readonly profile: CustomerProfile;
  readonly security: { readonly twoFactor: TwoFactorStatus; readonly sessions: readonly AccountSession[] };
  readonly preferences: { readonly channels: ChannelPreferences; readonly pushDevices: readonly PushDevice[] };
  readonly kyc: {
    readonly overview: KycOverview;
    readonly documents: readonly Omit<KycDocument, "fileName" | "sizeBytes">[];
  };
  readonly responsibleGaming: { readonly limits: LimitsSummary; readonly history: readonly LimitHistoryEntry[] };
  readonly notifications: readonly Notification[];
  readonly deletion: AccountDeletion;
  readonly notIncluded: readonly string[];
}

export interface AccountController {
  readonly updateProfile: (context: HttpRouterContext) => Promise<CustomerProfile>;
  readonly exportData: (context: HttpRouterContext) => Promise<AccountExport>;
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
    updateProfile: async (context) =>
      commandBus.execute<UpdateCustomerProfileCommand, CustomerProfile>(
        new UpdateCustomerProfileCommand(customerCaller(context), parseBody(context.request, updateProfileValidator)),
      ),

    exportData: async (context) => {
      const caller = customerCaller(context);
      const profile = await queryBus.execute<GetAccountProfileQuery, CustomerProfile>(new GetAccountProfileQuery(caller));
      const [twoFactor, sessions, channels, pushDevices, overview, documents, limits, history, notifications, deletion] = await Promise.all([
        queryBus.execute<GetTwoFactorStatusQuery, TwoFactorStatus>(new GetTwoFactorStatusQuery(caller)),
        queryBus.execute<ListAccountSessionsQuery, readonly AccountSession[]>(new ListAccountSessionsQuery(caller)),
        queryBus.execute<GetChannelPreferencesQuery, ChannelPreferences>(new GetChannelPreferencesQuery(caller)),
        queryBus.execute<ListPushDevicesQuery, readonly PushDevice[]>(new ListPushDevicesQuery(caller)),
        queryBus.execute<GetKycOverviewQuery, KycOverview>(new GetKycOverviewQuery(caller)),
        queryBus.execute<ListKycDocumentsQuery, readonly KycDocument[]>(new ListKycDocumentsQuery(caller)),
        queryBus.execute<GetLimitsSummaryQuery, LimitsSummary>(new GetLimitsSummaryQuery(caller)),
        queryBus.execute<ListLimitHistoryQuery, readonly LimitHistoryEntry[]>(new ListLimitHistoryQuery(caller)),
        queryBus.execute<ListNotificationsQuery, readonly Notification[]>(new ListNotificationsQuery(profile.id, NOTIFICATION.LIST_MAX)),
        queryBus.execute<GetAccountDeletionQuery, AccountDeletion>(new GetAccountDeletionQuery(caller)),
      ]);

      return {
        format: "betng.account-export.v1",
        exportedAt: new Date().toISOString(),
        profile,
        security: { twoFactor, sessions },
        preferences: { channels, pushDevices },
        kyc: {
          overview,
          documents: documents.map(({ fileName: _name, sizeBytes: _size, ...status }) => status),
        },
        responsibleGaming: { limits, history },
        notifications,
        deletion,
        notIncluded: [
          "Wallet transactions, payments and bets: request an account statement (POST /api/v1/account/statements).",
          "KYC document files and BVN/NIN numbers: held for verification and never exported.",
          "Passwords, two-factor secrets, backup codes and session tokens.",
        ],
      };
    },

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
