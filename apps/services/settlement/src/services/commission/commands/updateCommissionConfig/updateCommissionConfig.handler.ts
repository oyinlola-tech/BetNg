import { CommandHandler } from "@zudojs/cqrs";
import { notFound } from "@betng/service-kit";
import { ErrorCodes } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type {
  AuditRecorder,
  CommissionRepository,
  PlatformReader,
} from "../../../../interfaces/index.js";
import type { CommissionConfigRecord } from "../../../../models/index.js";
import { percentToBasisPoints } from "../../../../utils/index.js";
import type { UpdateCommissionConfigCommand } from "./updateCommissionConfig.command.js";

function auditView(config: CommissionConfigRecord): Record<string, unknown> {
  return {
    shopId: config.shopId,
    shopSharePercent: config.shopSharePercent,
    effectiveFrom: config.effectiveFrom.toISOString(),
  };
}

export class UpdateCommissionConfigHandler extends CommandHandler<
  UpdateCommissionConfigCommand,
  CommissionConfigRecord
> {
  public readonly commandType = SETTLEMENT_COMMAND.UPDATE_COMMISSION_CONFIG;

  private readonly commission: CommissionRepository;
  private readonly platform: PlatformReader;
  private readonly audit: AuditRecorder;

  public constructor(commission: CommissionRepository, platform: PlatformReader, audit: AuditRecorder) {
    super();
    this.commission = commission;
    this.platform = platform;
    this.audit = audit;
  }

  public async execute(command: UpdateCommissionConfigCommand): Promise<CommissionConfigRecord> {
    const shopId = command.shopId ?? null;

    if (shopId !== null && !(await this.platform.findShopNames([shopId])).has(shopId)) {
      throw notFound("The shop does not exist.", { code: ErrorCodes.NOT_FOUND, expose: true });
    }

    // The audit entry is written inside the transaction: if it fails, the new version is rolled back.
    const change = await this.commission.append(
      {
        shopId,
        shopShareBasisPoints: percentToBasisPoints(command.shopSharePercent),
        createdBy: command.actor.actorId,
        reason: command.reason,
      },
      async ({ before, after }) =>
        this.audit.recordRequired({
          ...command.actor,
          action: AUDIT_ACTION.COMMISSION_CONFIGURATION_CHANGED,
          entityType: AUDIT_ENTITY.COMMISSION_CONFIG,
          entityId: shopId ?? "default",
          ...(before === undefined ? {} : { before: auditView(before) }),
          after: auditView(after),
          reason: command.reason,
          severity: "NOTICE",
        }),
    );

    return change.after;
  }
}
