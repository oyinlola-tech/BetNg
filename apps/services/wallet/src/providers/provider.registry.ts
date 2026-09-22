import type { Bank } from "@betng/contracts";
import type { PaymentSettings } from "../configs/index.js";
import { BANKS_CACHE_TTL_MS } from "../constants/payments.constant.js";
import type { ProviderId } from "../constants/payments.constant.js";
import { createBachsProvider } from "./bachs.provider.js";
import { createFlutterwaveProvider } from "./flutterwave.provider.js";
import { createPaystackProvider } from "./paystack.provider.js";
import { ProviderUnavailableError } from "./provider.http.js";
import type { PaymentProvider } from "./provider.interface.js";
import { createSandboxProvider } from "./sandbox.provider.js";

export interface ProviderHealth {
  readonly provider: ProviderId;
  readonly status: "UP" | "DEGRADED" | "DOWN";
  readonly checkedAt: string;
}

export interface ProviderRegistry {
  /** The provider new payments go to; undefined when payments are off. */
  readonly active: PaymentProvider | undefined;
  get(id: ProviderId): PaymentProvider | undefined;
  banks(provider: PaymentProvider): Promise<readonly Bank[]>;
  health(): Promise<readonly ProviderHealth[]>;
}

const WINDOW = 5;
const STALE_MS = 10 * 60 * 1000;

interface Sample {
  readonly ok: boolean;
  readonly at: number;
}

type AsyncMethod = "initiateDeposit" | "verifyDeposit" | "listBanks" | "resolveAccount" | "transfer" | "transferStatus" | "probe";

const TRACKED: readonly AsyncMethod[] = ["initiateDeposit", "verifyDeposit", "listBanks", "resolveAccount", "transfer", "transferStatus", "probe"];

/** Counts unreachable/5xx answers against the provider; a 4xx refusal still proves it is up. */
function tracked(provider: PaymentProvider, samples: Sample[]): PaymentProvider {
  const note = (ok: boolean): void => {
    samples.push({ ok, at: Date.now() });

    if (samples.length > WINDOW) {
      samples.shift();
    }
  };

  const wrapped: Record<string, unknown> = { ...provider };

  for (const method of TRACKED) {
    const original = Reflect.get(provider, method) as (...args: unknown[]) => Promise<unknown>;

    wrapped[method] = async (...args: unknown[]) => {
      try {
        const result = await original.apply(provider, args);

        note(true);

        return result;
      } catch (error) {
        note(!(error instanceof ProviderUnavailableError));
        throw error;
      }
    };
  }

  return wrapped as unknown as PaymentProvider;
}

export function createProviderRegistry(settings: PaymentSettings): ProviderRegistry {
  const adapters = new Map<ProviderId, PaymentProvider>();
  const samples = new Map<ProviderId, Sample[]>();
  const bankCache = new Map<ProviderId, { readonly at: number; readonly banks: readonly Bank[] }>();

  const add = (provider: PaymentProvider): void => {
    const list: Sample[] = [];

    samples.set(provider.id, list);
    adapters.set(provider.id, tracked(provider, list));
  };

  if (settings.paystack !== undefined) {
    add(createPaystackProvider(settings.paystack, settings.providerTimeoutMs));
  }

  if (settings.flutterwave !== undefined) {
    add(createFlutterwaveProvider(settings.flutterwave, settings.providerTimeoutMs));
  }

  add(createBachsProvider());

  if (settings.activeProvider === "SANDBOX" && settings.environment !== "production") {
    add(createSandboxProvider());
  }

  const active = settings.activeProvider === undefined ? undefined : adapters.get(settings.activeProvider);

  return {
    active,

    get: (id) => adapters.get(id),

    banks: async (provider) => {
      const cached = bankCache.get(provider.id);

      if (cached !== undefined && Date.now() - cached.at < BANKS_CACHE_TTL_MS) {
        return cached.banks;
      }

      const banks = (await provider.listBanks())
        .filter((bank) => bank.code.length >= 2 && bank.code.length <= 10 && bank.name.length >= 2)
        .map((bank) => ({ code: bank.code, name: bank.name.slice(0, 80) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      bankCache.set(provider.id, { at: Date.now(), banks });

      return banks;
    },

    health: async () => {
      const report: ProviderHealth[] = [];

      for (const [id, provider] of adapters) {
        if (!provider.configured) {
          report.push({ provider: id, status: "DOWN", checkedAt: new Date().toISOString() });
          continue;
        }

        const list = samples.get(id) ?? [];
        const latest = list.at(-1);

        if (latest === undefined || Date.now() - latest.at > STALE_MS) {
          await provider.probe().catch(() => undefined);
        }

        const window = samples.get(id) ?? [];
        const failures = window.filter((sample) => !sample.ok).length;
        const status = failures === 0 ? "UP" : failures === window.length ? "DOWN" : "DEGRADED";

        report.push({ provider: id, status, checkedAt: new Date(window.at(-1)?.at ?? Date.now()).toISOString() });
      }

      return report;
    },
  };
}
