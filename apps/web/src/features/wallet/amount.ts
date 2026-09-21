import { z } from "zod";
import { currentCurrency, formatMoney, parseMoney } from "@betng/ui-core";

/** Minor units as editable text: no symbol, so it round-trips through `parseMoney`. */
export function amountInputValue(minorUnits: number): string {
  return formatMoney(minorUnits, {
    currency: { ...currentCurrency(), symbol: "" },
  });
}

export interface AmountBounds {
  readonly min?: number;
  readonly max?: number;
  readonly maxMessage?: string;
}

export function amountField(bounds: AmountBounds = {}) {
  return z
    .string()
    .trim()
    .min(1, "Enter an amount.")
    .superRefine((text, ctx) => {
      const amount = parseMoney(text);

      if (amount === undefined) {
        ctx.addIssue({ code: "custom", message: "Enter an amount in digits, for example 2,500 or 2500.50." });

        return;
      }

      if (amount <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount above zero." });

        return;
      }

      if (bounds.min !== undefined && amount < bounds.min)
        ctx.addIssue({ code: "custom", message: `The minimum is ${formatMoney(bounds.min)}.` });

      if (bounds.max !== undefined && amount > bounds.max)
        ctx.addIssue({
          code: "custom",
          message: bounds.maxMessage ?? `The maximum is ${formatMoney(bounds.max)}.`,
        });
    });
}
