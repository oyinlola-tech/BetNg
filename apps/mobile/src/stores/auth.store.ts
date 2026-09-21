import { create } from "zustand";

export interface AuthIntent {
  readonly reason: string;
  readonly run?: () => void;
}

interface AuthFlowState {
  readonly intent: AuthIntent | undefined;
  setIntent: (intent: AuthIntent | undefined) => void;
  take: () => AuthIntent | undefined;
}

export const useAuthFlow = create<AuthFlowState>()((set, get) => ({
  intent: undefined,
  setIntent: (intent) => {
    set({ intent });
  },
  take: () => {
    const { intent } = get();

    set({ intent: undefined });

    return intent;
  },
}));
