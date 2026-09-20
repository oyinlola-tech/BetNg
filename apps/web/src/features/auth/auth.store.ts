import { create } from "zustand";

export type AuthView = "login" | "register" | "verify" | "forgot" | "expired";

/** What the user was doing when sign-in was asked for; it runs once they are in. */
export interface AuthIntent {
  readonly reason: string;
  readonly run?: () => void;
}

interface AuthDialogState {
  readonly open: boolean;
  readonly view: AuthView;
  readonly intent: AuthIntent | undefined;
  readonly pendingEmail: string;
  show: (view: AuthView, intent?: AuthIntent) => void;
  setView: (view: AuthView) => void;
  setPendingEmail: (email: string) => void;
  close: () => void;
  /** Closes the dialog and hands back the intent to resume. */
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
