import { create } from 'zustand';

interface AppState {
  clicks: number;
  increment: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  clicks: 0,
  increment: () => {
    set((state) => ({ clicks: state.clicks + 1 }));
  },
}));
