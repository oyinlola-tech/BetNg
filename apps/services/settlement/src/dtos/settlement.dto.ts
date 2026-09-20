/**
 * The response shapes the settlement endpoints return.
 */

import type { Settlement } from "@betng/contracts";

export interface SettlementListDto {
  readonly items: readonly Settlement[];
}
