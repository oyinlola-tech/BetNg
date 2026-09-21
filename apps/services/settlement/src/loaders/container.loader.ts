import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import {
  AUDIT_RECORDER_TOKEN,
  COMMISSION_REPOSITORY_TOKEN,
  EFFECTS_APPLIER_TOKEN,
  LOGGER_TOKEN,
  MATCH_SETTLER_TOKEN,
  OPERATOR_REPOSITORY_TOKEN,
  PLATFORM_READER_TOKEN,
  SETTLEMENT_REPOSITORY_TOKEN,
} from "../constants/index.js";
import type {
  AuditRecorder,
  BettingPeer,
  CommissionRepository,
  OperatorRepository,
  PlatformReader,
  SettlementRepository,
  WalletPeer,
} from "../interfaces/index.js";
import { EffectsApplier, MatchSettler } from "../services/index.js";

export interface ContainerLoaderConfig {
  readonly settlements: SettlementRepository;
  readonly operator: OperatorRepository;
  readonly commission: CommissionRepository;
  readonly platform: PlatformReader;
  readonly betting: BettingPeer;
  readonly wallet: WalletPeer;
  readonly audit: AuditRecorder;
  readonly logger: Logger;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  const effects = new EffectsApplier({
    settlements: config.settlements,
    betting: config.betting,
    wallet: config.wallet,
    logger: config.logger,
  });

  const settler = new MatchSettler({
    settlements: config.settlements,
    platform: config.platform,
    effects,
    audit: config.audit,
    logger: config.logger,
  });

  container.registerValue(SETTLEMENT_REPOSITORY_TOKEN, config.settlements);
  container.registerValue(OPERATOR_REPOSITORY_TOKEN, config.operator);
  container.registerValue(COMMISSION_REPOSITORY_TOKEN, config.commission);
  container.registerValue(PLATFORM_READER_TOKEN, config.platform);
  container.registerValue(AUDIT_RECORDER_TOKEN, config.audit);
  container.registerValue(EFFECTS_APPLIER_TOKEN, effects);
  container.registerValue(MATCH_SETTLER_TOKEN, settler);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
