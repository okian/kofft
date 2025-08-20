import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { UIState } from '@/shared/types'

interface UIStore extends UIState {
  // Actions
  setMetadataPanelOpen: (open: boolean) => void
  setPlaylistPanelOpen: (open: boolean) => void
  setSettingsPanelOpen: (open: boolean) => void
  setShortcutsHelpOpen: (open: boolean) => void
  setFullscreen: (fullscreen: boolean) => void
  setMobile: (mobile: boolean) => void
  setTablet: (tablet: boolean) => void
  toggleMetadataPanel: () => void
  togglePlaylistPanel: () => void
  toggleSettingsPanel: () => void
  toggleShortcutsHelp: () => void
  closeAllPanels: () => void
  updateScreenSize: () => void
}

const initialState: UIState = {
  metadataPanelOpen: false,
  playlistPanelOpen: true, // Make playlist visible by default
  settingsPanelOpen: false,
  shortcutsHelpOpen: false,
  isFullscreen: false,
  isMobile: false,
  isTablet: false,
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setMetadataPanelOpen: (open) => set({ metadataPanelOpen: open }),
    setPlaylistPanelOpen: (open) => set({ playlistPanelOpen: open }),
    setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),
    setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
    setMobile: (mobile) => set({ isMobile: mobile }),
    setTablet: (tablet) => set({ isTablet: tablet }),

    toggleMetadataPanel: () => {
      const { metadataPanelOpen } = get()
      set({ metadataPanelOpen: !metadataPanelOpen })
    },

    togglePlaylistPanel: () => {
      const { playlistPanelOpen } = get()
      set({ playlistPanelOpen: !playlistPanelOpen })
    },

    toggleSettingsPanel: () => {
      const { settingsPanelOpen } = get()
      set({ settingsPanelOpen: !settingsPanelOpen })
    },

    toggleShortcutsHelp: () => {
      const { shortcutsHelpOpen } = get()
      set({ shortcutsHelpOpen: !shortcutsHelpOpen })
    },

    closeAllPanels: () => {
      set({
        metadataPanelOpen: false,
        playlistPanelOpen: false,
        settingsPanelOpen: false,
        shortcutsHelpOpen: false,
      })
    },

    updateScreenSize: () => {
      const width = window.innerWidth
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      
      set({ isMobile, isTablet })
    },
  }))
)
