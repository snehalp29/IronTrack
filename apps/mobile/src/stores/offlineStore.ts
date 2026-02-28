import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  pendingSyncCount: number;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  pendingSyncCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
}));
