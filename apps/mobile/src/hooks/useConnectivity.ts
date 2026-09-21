import { canRunFinancialCommand } from "../platform/offlineCache";
import { useConnection } from "./useConnection";

/** False while the platform is unreachable; financial commands are refused rather than queued. */
export function useCanTransact(): boolean {
  return canRunFinancialCommand(useConnection());
}
