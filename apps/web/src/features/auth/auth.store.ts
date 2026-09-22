import { create } from "zustand";

import type { TwoFactorChallenge } from "@betng/contracts";

export type AuthView = "login" | "register" | "verify" | "forgot" | "reset" | "two-factor" | "expired";

export type AuthIntentName =
  | "place-bet"
  | "tickets"
  | "wallet"
  | "transactions"
  | "notifications"
  | "account";

export interface AuthIntent {
  readonly reason: string;
  readonly run?: () => void;
}

export const INTENT_REASONS: Readonly<Record<AuthIntentName, string>> = {
  "place-bet": "Sign in to place this bet. Your slip stays as it is.",
  tickets: "Sign in to see your tickets.",
  wallet: "Sign in to open your wallet.",
  transactions: "Sign in to see your transactions.",
  notifications: "Sign in to see your notifications.",
  account: "Sign in to manage your account.",
};

interface AuthDialogState {
  readonly open: boolean;
  readonly view: AuthView;
  readonly intent: AuthIntent | undefined;
  readonly pendingEmail: string;
  /** In memory only: the platform's pending second-factor challenge for this sign-in attempt. */
  readonly challenge: TwoFactorChallenge | undefined;
  show: (view: AuthView, intent?: AuthIntent) => void;
  setView: (view: AuthView) => void;
  setPendingEmail: (email: string) => void;
  setChallenge: (challenge: TwoFactorChallenge | undefined) => void;
  close: () => void;
  complete: () => AuthIntent | undefined;
}

export const useAuthDialog = create<AuthDialogState>()((set, get) => ({
  open: false,
  view: "login",
  intent: undefined,
  pendingEmail: "",
  challenge: undefined,
  show: (view, intent) => {
    set({ open: true, view, intent, challenge: undefined });
  },
  setView: (view) => {
    set({ view });
  },
  setPendingEmail: (pendingEmail) => {
    set({ pendingEmail });
  },
  setChallenge: (challenge) => {
    set({ challenge });
  },
  close: () => {
    set({ open: false, intent: undefined, challenge: undefined });
  },
  complete: () => {
    const { intent } = get();

    set({ open: false, intent: undefined, challenge: undefined });

    return intent;
  },
}));
