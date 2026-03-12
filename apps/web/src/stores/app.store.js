import { create } from 'zustand';
export const useAppStore = create((set) => ({
    clicks: 0,
    increment: () => {
        set((state) => ({ clicks: state.clicks + 1 }));
    },
}));
