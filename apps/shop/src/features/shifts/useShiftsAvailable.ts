import { DataSourceError } from "@betng/ui-core";
import { useFlag } from "@betng/ui-web";

export function isNotImplemented(error: unknown): boolean {
  return error instanceof DataSourceError && error.code === "NOT_IMPLEMENTED";
}

export function useShiftsEnabled(): boolean {
  return useFlag("cashShiftsEnabled");
}
