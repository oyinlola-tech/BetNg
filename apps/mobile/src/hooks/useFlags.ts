import type { FeatureFlags } from "@betng/ui-core";
import { getRuntimeInfo } from "../services/dataSource";

export function useFlags(): FeatureFlags {
  return getRuntimeInfo().flags;
}
