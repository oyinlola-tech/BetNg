import { create } from "zustand";

export type AuthView = "login" | "register" | "verify" | "forgot" | "expired";

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
  show: (view: AuthView, intent?: AuthIntent) => void;
  setView: (view: AuthView) => void;
  setPendingEmail: (email: string) => void;
  close: () => void;
  complete: () => AuthIntent | undefined;
}

export const useAuthDialog = create<AuthDialogState>()((set, get) => ({
  open: false,
  view: "login",
  intent: undefined,
  pendingEmail: "",
  show: (view, intent) => {
    set({ open: true, view, intent });
  },
  setView: (view) => {
    set({ view });
  },
  setPendingEmail: (pendingEmail) => {
    set({ pendingEmail });
  },
  close: () => {
    set({ open: false, intent: undefined });
  },
  complete: () => {
    const { intent } = get();

    set({ open: false, intent: undefined });

    return intent;
  },
}));
