import { create } from 'zustand'

interface PlaylistSearchState {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const usePlaylistSearchStore = create<PlaylistSearchState>((set) => ({
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery })
}))
