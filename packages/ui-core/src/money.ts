import type { CurrencyConfig } from "./types/index.js";

export interface Money {
  readonly amount: number;
  readonly currency: string;
}

const DEFAULT_CURRENCY: CurrencyConfig = Object.freeze({
  code: "NGN",
  symbol: "₦",
  minorUnits: 2,
  locale: "en-NG",
});

let active: CurrencyConfig = DEFAULT_CURRENCY;
const formatters = new Map<string, Intl.NumberFormat>();

export function configureCurrency(config: CurrencyConfig): void {
  active = Object.freeze({ ...config });
  formatters.clear();
}

export function currentCurrency(): CurrencyConfig {
  return active;
}

function groupFormatter(locale: string): Intl.NumberFormat {
  let formatter = formatters.get(locale);

  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    formatters.set(locale, formatter);
  }

  return formatter;
}

function split(minorUnits: number, digits: number): [bigint, string] {
  const value = BigInt(Math.trunc(Math.abs(minorUnits)));
  const base = 10n ** BigInt(digits);
  const fraction = (value % base).toString().padStart(digits, "0");

  return [value / base, digits === 0 ? "" : fraction];
}

export interface MoneyFormatOptions {
  readonly currency?: CurrencyConfig;
  readonly sign?: "auto" | "always";
  readonly fraction?: "always" | "never";
}

export function formatMoney(
  minorUnits: number,
  options: MoneyFormatOptions = {},
): string {
  const currency = options.currency ?? active;
  const [whole, fraction] = split(minorUnits, currency.minorUnits);
  const negative = minorUnits < 0;
  const sign = negative ? "-" : options.sign === "always" ? "+" : "";
  const grouped = groupFormatter(currency.locale).format(whole);
  const tail =
    options.fraction === "never" || fraction === "" ? "" : `.${fraction}`;

  return `${sign}${currency.symbol}${grouped}${tail}`;
}

export function formatMoneyCompact(minorUnits: number): string {
  const digits = active.minorUnits;
  const base = 10 ** digits;
  const rounded = Math.round(minorUnits / base) * base;

  return formatMoney(rounded, { fraction: "never" });
}

export function formatSignedMoney(minorUnits: number): string {
  return formatMoney(minorUnits, { sign: "always" });
}

export function formatCurrency(money: Money): string {
  return money.currency === active.code
    ? formatMoney(money.amount)
    : `${money.currency} ${formatMoney(money.amount, { currency: { ...active, symbol: "" } })}`;
}

export function parseMoney(
  text: string,
  currency: CurrencyConfig = active,
): number | undefined {
  const cleaned = text.replace(/[\s,_]/g, "").replace(currency.symbol, "");
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);

  if (match === null) return undefined;

  const digits = currency.minorUnits;
  const fraction = (match[2] ?? "").slice(0, digits).padEnd(digits, "0");
  const value = BigInt(match[1] ?? "0") * 10n ** BigInt(digits) + BigInt(fraction === "" ? "0" : fraction);

  return value > BigInt(Number.MAX_SAFE_INTEGER) ? undefined : Number(value);
}

const ODDS_SCALE = 100n;

function scaledOdds(odds: number): bigint {
  return BigInt(Math.round(odds * 100));
}

export function multiplyOdds(odds: readonly number[]): number {
  if (odds.length === 0) return 0;

  const product = odds.reduce((acc, o) => acc * scaledOdds(o), 1n);
  const divisor = ODDS_SCALE ** BigInt(odds.length - 1);

  return Number((product + divisor / 2n) / divisor) / 100;
}

export function estimateReturn(
  stakeMinorUnits: number,
  odds: readonly number[],
): number {
  if (odds.length === 0 || stakeMinorUnits <= 0) return 0;

  const product = odds.reduce((acc, o) => acc * scaledOdds(o), 1n);
  const divisor = ODDS_SCALE ** BigInt(odds.length);
  const total = BigInt(Math.trunc(stakeMinorUnits)) * product;

  return Number((total + divisor / 2n) / divisor);
}
