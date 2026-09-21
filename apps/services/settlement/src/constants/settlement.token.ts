import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type {
  AuditRecorder,
  CommissionRepository,
  OperatorRepository,
  PlatformReader,
  SettlementRepository,
} from "../interfaces/index.js";
import type { EffectsApplier, MatchSettler } from "../services/settlement/index.js";

export const SETTLEMENT_REPOSITORY_TOKEN = createToken<SettlementRepository>(
  "settlement.repository",
);

export const OPERATOR_REPOSITORY_TOKEN = createToken<OperatorRepository>(
  "settlement.operatorRepository",
);

export const COMMISSION_REPOSITORY_TOKEN = createToken<CommissionRepository>(
  "settlement.commissionRepository",
);

export const PLATFORM_READER_TOKEN = createToken<PlatformReader>(
  "settlement.platformReader",
);

export const AUDIT_RECORDER_TOKEN = createToken<AuditRecorder>(
  "settlement.auditRecorder",
);

export const EFFECTS_APPLIER_TOKEN = createToken<EffectsApplier>(
  "settlement.effectsApplier",
);

export const MATCH_SETTLER_TOKEN = createToken<MatchSettler>(
  "settlement.matchSettler",
);

export const LOGGER_TOKEN = createToken<Logger>("settlement.logger");
