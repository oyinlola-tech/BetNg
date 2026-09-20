/**
 * The response shapes the betting endpoints return.
 */

import type { Bet } from "@betng/contracts";

export interface BetListDto {
  readonly items: readonly Bet[];
}
