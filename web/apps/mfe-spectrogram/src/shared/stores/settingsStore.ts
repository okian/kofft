import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { THEME_COLORS } from "@/shared/theme";
import {
  SpectrogramSettings,
  Theme,
  AmplitudeScale,
  FrequencyScale,
  Resolution,
  RefreshRate,
  APIKeys,
  APIKeyStatus,
} from "@/shared/types";

interface SettingsStore extends SpectrogramSettings {
  // Actions
  setTheme: (theme: Theme) => void;
  setAmplitudeScale: (scale: AmplitudeScale) => void;
  setFrequencyScale: (scale: FrequencyScale) => void;
  setResolution: (resolution: Resolution) => void;
  setRefreshRate: (rate: RefreshRate) => void;
  setColormap: (colormap: string) => void;
  setShowLegend: (show: boolean) => void;
  setEnableToastNotifications: (enable: boolean) => void;
  /** User-defined override for the played portion colour. */
  setSeekPlayedColor: (color: string) => void;
  /** User-defined override for the unplayed portion colour. */
  setSeekUnplayedColor: (color: string) => void;
  /** Clears both colour overrides, reverting to theme defaults. */
  resetSeekbarColors: () => void;
  /** Selects how the seek bar visualises audio data. */
  setSeekbarMode: (mode: "live" | "frequency" | "waveform") => void;
  /** Adjusts the statistical significance level used when drawing bars. */
  setSeekbarSignificance: (level: number) => void;
  /** Scales bar amplitudes without altering audio. */
  setSeekbarAmplitudeScale: (scale: number) => void;
  updateSettings: (settings: Partial<SpectrogramSettings>) => void;
  resetToDefaults: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // API Key actions
  setAPIKey: (service: keyof APIKeys, key: string) => void;
  validateAPIKey: (service: keyof APIKeys) => Promise<boolean>;
  getAPIKeyStatus: () => APIKeyStatus;

  // Artwork settings actions
  setEnableExternalArtwork: (enable: boolean) => void;
  setEnableAcoustID: (enable: boolean) => void;
  setEnableMusicBrainz: (enable: boolean) => void;
  setEnablePlaceholderArtwork: (enable: boolean) => void;
}

/** Default settings used when no user overrides are present. */
const defaultSettings: SpectrogramSettings = {
  theme: "dark",
  amplitudeScale: "db",
  frequencyScale: "logarithmic",
  resolution: "medium",
  refreshRate: 60,
  colormap: "viridis",
  showLegend: true,
  enableToastNotifications: false, // Disabled by default
  // Seekbar color overrides: empty strings mean use theme defaults.
  seekPlayedColor: "",
  seekUnplayedColor: "",
  // Seekbar visualisation defaults
  seekbarMode: "waveform",
  seekbarSignificance: 0.5,
  seekbarAmplitudeScale: 1,
  // API Keys
  apiKeys: {},
  apiKeyStatus: {
    acoustid: { valid: false },
    musicbrainz: { valid: false },
  },
  // Artwork settings
  enableExternalArtwork: true,
  enableAcoustID: true,
  enableMusicBrainz: true,
  enablePlaceholderArtwork: true,
};

/** Key used for persisting settings in localStorage. */
export const STORAGE_KEY = "spectrogram-settings";

/** Allowed seekbar modes. Exported for validation in tests. */
export const VALID_SEEKBAR_MODES = ["live", "frequency", "waveform"] as const;
/** Minimum accepted seekbar significance. */
const SEEKBAR_MIN_SIGNIFICANCE = 0;
/** Maximum accepted seekbar significance. */
const SEEKBAR_MAX_SIGNIFICANCE = 1;

/** Trim and validate a CSS colour string. Returns empty string if invalid. */
function sanitiseColor(color: string): string {
  const trimmed = color.trim();
  if (trimmed) {
    const cssSupported =
      typeof CSS !== "undefined" && (CSS as any).supports?.("color", trimmed);
    const hexMatch = /^#([0-9a-fA-F]{3}){1,2}$/.test(trimmed);
    if (!cssSupported && !hexMatch) {
      console.warn("Invalid colour override", trimmed);
      return "";
    }
  }
  return trimmed;
}

/** Filter and validate a partially loaded settings object. */
function sanitiseSettings(input: any): SpectrogramSettings {
  const result: SpectrogramSettings = { ...defaultSettings };
  if (typeof input !== "object" || !input) return result;

  if (typeof input.theme === "string" && input.theme in THEME_COLORS)
    result.theme = input.theme as Theme;

  if (typeof input.seekPlayedColor === "string")
    result.seekPlayedColor = sanitiseColor(input.seekPlayedColor);

  if (typeof input.seekUnplayedColor === "string")
    result.seekUnplayedColor = sanitiseColor(input.seekUnplayedColor);

  if (VALID_SEEKBAR_MODES.includes(input.seekbarMode))
    result.seekbarMode = input.seekbarMode as any;

  if (typeof input.seekbarSignificance === "number") {
    const level = Math.min(
      SEEKBAR_MAX_SIGNIFICANCE,
      Math.max(SEEKBAR_MIN_SIGNIFICANCE, input.seekbarSignificance),
    );
    result.seekbarSignificance = level;
  }

  if (
    typeof input.seekbarAmplitudeScale === "number" &&
    input.seekbarAmplitudeScale > 0
  )
    result.seekbarAmplitudeScale = input.seekbarAmplitudeScale;

  return result;
}

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
    setEnableToastNotifications: (enableToastNotifications) =>
      set({ enableToastNotifications }),
    // Store colour overrides individually to avoid unnecessary object copies.
    setSeekPlayedColor: (color) =>
      set({ seekPlayedColor: sanitiseColor(color) }),
    setSeekUnplayedColor: (color) =>
      set({ seekUnplayedColor: sanitiseColor(color) }),
    // Reset both colours back to theme-driven defaults in one cheap update.
    resetSeekbarColors: () =>
      set({ seekPlayedColor: "", seekUnplayedColor: "" }),

    // Seek bar configuration setters with basic validation to fail fast on
    // invalid input. Each setter clamps or verifies inputs instead of silently
    // accepting broken values that could later crash rendering code.
    setSeekbarMode: (seekbarMode) => {
      if (!VALID_SEEKBAR_MODES.includes(seekbarMode as any)) {
        console.error("invalid seekbar mode", seekbarMode);
        throw new Error("invalid seekbar mode");
      }
      set({ seekbarMode });
    },
    setSeekbarSignificance: (seekbarSignificance) => {
      if (!Number.isFinite(seekbarSignificance)) {
        console.error(
          "seekbarSignificance must be finite",
          seekbarSignificance,
        );
        throw new Error("seekbarSignificance must be finite");
      }
      const level = Math.min(
        SEEKBAR_MAX_SIGNIFICANCE,
        Math.max(SEEKBAR_MIN_SIGNIFICANCE, seekbarSignificance),
      );
      if (level !== seekbarSignificance) {
        console.warn("seekbarSignificance clamped", seekbarSignificance);
      }
      set({ seekbarSignificance: level });
    },
    setSeekbarAmplitudeScale: (seekbarAmplitudeScale) => {
      if (
        !Number.isFinite(seekbarAmplitudeScale) ||
        seekbarAmplitudeScale <= 0
      ) {
        console.error(
          "seekbarAmplitudeScale must be a positive finite number",
          seekbarAmplitudeScale,
        );
        throw new Error("seekbarAmplitudeScale must be positive");
      }
      set({ seekbarAmplitudeScale });
    },

    updateSettings: (settings) => {
      const sanitised = sanitiseSettings(settings);
      set((state) => ({ ...state, ...sanitised }));
    },

    resetToDefaults: () => {
      set(defaultSettings);
    },

    loadFromStorage: () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const settings = sanitiseSettings(parsed);
          set((state) => ({ ...state, ...settings }));
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    },

    saveToStorage: () => {
      try {
        const settings = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save settings", error);
      }
    },

    // API Key actions
    setAPIKey: (service, key) => {
      set((state) => ({
        apiKeys: { ...state.apiKeys, [service]: key },
        apiKeyStatus: {
          ...state.apiKeyStatus,
          [service]: { valid: false, lastChecked: undefined },
        },
      }));
    },

    validateAPIKey: async (service) => {
      const state = get();
      const apiKey = state.apiKeys[service];

      if (!apiKey) {
        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: false, lastChecked: new Date() },
          },
        }));
        return false;
      }

      try {
        let isValid = false;

        if (service === "acoustid") {
          // Test AcoustID API
          const response = await fetch(
            `https://api.acoustid.org/v2/lookup?client=${apiKey}&meta=recordings+releasegroups&fingerprint=test&duration=1`,
          );
          isValid = response.ok;
        } else if (service === "musicbrainz") {
          // Test MusicBrainz API (no API key required, but we can test the endpoint)
          const response = await fetch(
            'https://musicbrainz.org/ws/2/release/?query=artist:"test"&fmt=json&limit=1',
          );
          isValid = response.ok;
        }

        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: isValid, lastChecked: new Date() },
          },
        }));

        return isValid;
      } catch (error) {
        set((state) => ({
          apiKeyStatus: {
            ...state.apiKeyStatus,
            [service]: { valid: false, lastChecked: new Date() },
          },
        }));
        return false;
      }
    },

    getAPIKeyStatus: () => {
      return get().apiKeyStatus;
    },

    // Artwork settings actions
    setEnableExternalArtwork: (enable) =>
      set({ enableExternalArtwork: enable }),
    setEnableAcoustID: (enable) => set({ enableAcoustID: enable }),
    setEnableMusicBrainz: (enable) => set({ enableMusicBrainz: enable }),
    setEnablePlaceholderArtwork: (enable) =>
      set({ enablePlaceholderArtwork: enable }),
  })),
);

// Auto-save settings when they change
useSettingsStore.subscribe((state) => {
  state.saveToStorage();
});

// Load settings on initialization
if (typeof window !== "undefined") {
  useSettingsStore.getState().loadFromStorage();
}
