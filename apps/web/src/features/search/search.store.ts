import { create } from "zustand";

interface SearchDialogState {
  readonly open: boolean;
  show: () => void;
  close: () => void;
}

export const useSearchDialog = create<SearchDialogState>()((set) => ({
  open: false,
  show: () => {
    set({ open: true });
  },
  close: () => {
    set({ open: false });
  },
}));
