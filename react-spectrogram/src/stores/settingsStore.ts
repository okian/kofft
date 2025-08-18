import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { SpectrogramSettings, Theme, AmplitudeScale, FrequencyScale, Resolution, RefreshRate, APIKeys, APIKeyStatus } from '@/types'

interface SettingsStore extends SpectrogramSettings {
  // Actions
  setTheme: (theme: Theme) => void
  setAmplitudeScale: (scale: AmplitudeScale) => void
  setFrequencyScale: (scale: FrequencyScale) => void
  setResolution: (resolution: Resolution) => void
  setRefreshRate: (rate: RefreshRate) => void
  setColormap: (colormap: string) => void
  setShowLegend: (show: boolean) => void
  setEnableToastNotifications: (enable: boolean) => void
  updateSettings: (settings: Partial<SpectrogramSettings>) => void
  resetToDefaults: () => void
  loadFromStorage: () => void
  saveToStorage: () => void
  
  // API Key actions
  setAPIKey: (service: keyof APIKeys, key: string) => void
  validateAPIKey: (service: keyof APIKeys) => Promise<boolean>
  getAPIKeyStatus: () => APIKeyStatus
  
  // Artwork settings actions
  setEnableExternalArtwork: (enable: boolean) => void
  setEnableAcoustID: (enable: boolean) => void
  setEnableMusicBrainz: (enable: boolean) => void
  setEnablePlaceholderArtwork: (enable: boolean) => void
}

const defaultSettings: SpectrogramSettings = {
  theme: 'dark',
  amplitudeScale: 'db',
  frequencyScale: 'logarithmic',
  resolution: 'medium',
  refreshRate: 60,
  colormap: 'viridis',
  showLegend: true,
  enableToastNotifications: false, // Disabled by default
  // API Keys
  apiKeys: {},
  apiKeyStatus: {
    acoustid: { valid: false },
    musicbrainz: { valid: false }
  },
  // Artwork settings
  enableExternalArtwork: true,
  enableAcoustID: true,
  enableMusicBrainz: true,
  enablePlaceholderArtwork: true,
}

const STORAGE_KEY = 'spectrogram-settings'

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    ...defaultSettings,

    setTheme: (theme) => set({ theme }),
    setAmplitudeScale: (amplitudeScale) => set({ amplitudeScale }),
    setFrequencyScale: (frequencyScale) => set({ frequencyScale }),
    setResolution: (resolution) => set({ resolution }),
    setRefreshRate: (refreshRate) => set({ refreshRate }),
    setColormap: (colormap) => set({ colormap }),
    setShowLegend: (showLegend) => set({ showLegend }),
    setEnableToastNotifications: (enableToastNotifications) => set({ enableToastNotifications }),

    updateSettings: (settings) => {
      set((state) => ({ ...state, ...settings }))
    },

    resetToDefaults: () => {
      set(defaultSettings)
    },

    loadFromStorage: () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const settings = JSON.parse(stored)
          // Ensure all required fields are present
          const mergedSettings = { ...defaultSettings, ...settings }
          set((state) => ({ ...state, ...mergedSettings }))
        }
          } catch (error) {
      // Failed to load settings from storage
    }
    },

    saveToStorage: () => {
      try {
        const settings = get()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
          } catch (error) {
      // Failed to save settings to storage
    }
    },

    // API Key actions
    setAPIKey: (service, key) => {
      set((state) => ({
        apiKeys: { ...state.apiKeys, [service]: key },
        apiKeyStatus: {
          ...state.apiKeyStatus,
          [service]: { valid: false, lastChecked: undefined }
        }
      }))
    },

    validateAPIKey: async (service) => {
      const state = get()
      const apiKey = state.apiKeys[service]
      
      if (!apiKey) {
        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: false, lastChecked: new Date() }
          }
        }))
        return false
      }

      try {
        let isValid = false
        
        if (service === 'acoustid') {
          // Test AcoustID API
          const response = await fetch(`https://api.acoustid.org/v2/lookup?client=${apiKey}&meta=recordings+releasegroups&fingerprint=test&duration=1`)
          isValid = response.ok
        } else if (service === 'musicbrainz') {
          // Test MusicBrainz API (no API key required, but we can test the endpoint)
          const response = await fetch('https://musicbrainz.org/ws/2/release/?query=artist:"test"&fmt=json&limit=1')
          isValid = response.ok
        }

        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: isValid, lastChecked: new Date() }
          }
        }))

        return isValid
      } catch (error) {
        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: false, lastChecked: new Date() }
          }
        }))
        return false
      }
    },

    getAPIKeyStatus: () => {
      return get().apiKeyStatus
    },

    // Artwork settings actions
    setEnableExternalArtwork: (enable) => set({ enableExternalArtwork: enable }),
    setEnableAcoustID: (enable) => set({ enableAcoustID: enable }),
    setEnableMusicBrainz: (enable) => set({ enableMusicBrainz: enable }),
    setEnablePlaceholderArtwork: (enable) => set({ enablePlaceholderArtwork: enable }),
  }))
)

// Auto-save settings when they change
useSettingsStore.subscribe((state) => {
  state.saveToStorage()
})

// Load settings on initialization
if (typeof window !== 'undefined') {
  useSettingsStore.getState().loadFromStorage()
}
