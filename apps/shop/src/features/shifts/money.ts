import { parseMoney } from "@betng/ui-core";

export function parseAmount(text: string): number | undefined {
  const trimmed = text.trim();

  return trimmed === "" ? undefined : parseMoney(trimmed);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== "" ? error.message : fallback;
}
