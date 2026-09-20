import type { Bet } from "@betng/contracts";

export interface BetListDto {
  readonly items: readonly Bet[];
}
