import { createMockAccountServices, createMockAuthSource, createMockDataSource } from "@betng/mock-data";
import { DataSourceError, type AccountServicesSource, type AuthDataSource, type BetNgDataSource, type SessionStorage } from "@betng/ui-core";

export interface MockSources {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
  readonly accountServices: AccountServicesSource;
}

export function createMockSources(storage: {
  readonly session: Required<SessionStorage>;
  readonly local: Required<SessionStorage>;
}): MockSources {
  const mock = createMockDataSource({ storage: storage.local });

  window.addEventListener("offline", () => {
    mock.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    mock.platform.setOnline(true);
  });

  const authSource = createMockAuthSource({ storage: storage.session, isOnline: () => navigator.onLine });
  const accountServices = createMockAccountServices({
    session: authSource.session,
    storage: storage.local,
    wallet: {
      available: () => mock.platform.wallet().available,
      credit: (amount) => void mock.platform.deposit(amount),
      debit: (amount) => void mock.platform.withdraw(amount),
    },
  });

  /* The stand-in enforces self-exclusion where the platform's betting service will. */
  const dataSource: BetNgDataSource = Object.assign(Object.create(mock) as BetNgDataSource, {
    placeBet: async (input: Parameters<BetNgDataSource["placeBet"]>[0]) => {
      if ((await accountServices.limits.getSummary()).restricted) {
        throw new DataSourceError("SELF_EXCLUDED", "Betting is paused while your self-exclusion is active.");
      }

      return mock.placeBet(input);
    },
  });

  return { dataSource, authSource, accountServices };
}
