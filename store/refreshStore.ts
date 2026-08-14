import { create } from 'zustand'

interface RefreshStore {
  refreshKey: number
  bump: () => void
}

// Incremented whenever new data lands (manual upload or realtime notification),
// so data-fetching hooks across tabs know to refetch.
export const useRefreshStore = create<RefreshStore>((set) => ({
  refreshKey: 0,
  bump: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}))
