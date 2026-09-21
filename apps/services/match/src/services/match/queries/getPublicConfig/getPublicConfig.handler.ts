import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY, PUBLIC_CONFIG } from "../../../../constants/index.js";
import type { PublicConfigDto } from "../../../../dtos/index.js";
import type { StakeLimitsRow } from "../../../../interfaces/index.js";
import { errorMessage } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetPublicConfigQuery } from "./getPublicConfig.query.js";

export class GetPublicConfigHandler extends QueryHandler<
  GetPublicConfigQuery,
  PublicConfigDto
> {
  public readonly queryType = MATCH_QUERY.GET_PUBLIC_CONFIG;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(): Promise<PublicConfigDto> {
    const limits = await this.readLimits();
    const { timing } = this.deps;

    return {
      currency: PUBLIC_CONFIG.CURRENCY,
      features: PUBLIC_CONFIG.FEATURES,
      ...(limits === undefined
        ? {}
        : {
            stakeLimits: {
              min: limits.minStake,
              max: limits.maxStakePerBet,
              maxSelections: PUBLIC_CONFIG.MAX_SELECTIONS,
            },
          }),
      competitionTimezone: PUBLIC_CONFIG.COMPETITION_TIMEZONE,
      maintenance: false,
      timing: {
        secondsPerMinute: timing.secondsPerMinute,
        halfTimeSeconds: timing.halfTimeSeconds,
        bettingCloseLeadSeconds: timing.bettingCloseLeadSeconds,
        roundCycleSeconds: timing.roundCycleSeconds,
      },
    };
  }

  /** Another service's table: unreadable for any reason means the limits are left out, never a failed config. */
  private async readLimits(): Promise<StakeLimitsRow | undefined> {
    try {
      return await this.deps.risk.activeStakeLimits();
    } catch (error) {
      this.deps.logger.warn("Stake limits unreadable", {
        event: "match.stakeLimitsUnreadable",
        error: errorMessage(error),
      });

      return undefined;
    }
  }
}
