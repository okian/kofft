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
  LUT,
  LUTMode,
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
  /** User-defined override for the playhead colour. */
  setSeekPlayheadColor: (color: string) => void;
  /** Toggle playhead visibility. */
  setShowSeekbarPlayhead: (show: boolean) => void;
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

  // LUT actions
  setLUTMode: (mode: LUTMode) => void;
  setCurrentLUT: (lut: LUT | null) => void;
  addCustomLUT: (lut: LUT) => void;
  removeCustomLUT: (id: string) => void;
  updateCustomLUT: (id: string, lut: Partial<LUT>) => void;
}

/** Default settings used when no user overrides are present. */
const defaultSettings: SpectrogramSettings = {
  // Conservative monochrome theme avoids overly bright colours by default.
  theme: "japanese-a-light",
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
  seekPlayheadColor: "",
  showSeekbarPlayhead: true,
  // Seekbar visualisation defaults
  seekbarMode: "waveform", // Back to waveform mode
  seekbarSignificance: 0.05, // Even lower significance to show more bars
  seekbarAmplitudeScale: 8, // Much higher scale to make bars more visible
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
  // LUT settings
  lutMode: "builtin",
  currentLUT: null,
  customLUTs: [],
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

  // Theme
  if (typeof input.theme === "string" && input.theme in THEME_COLORS)
    result.theme = input.theme as Theme;

  // Spectrogram settings
  if (
    typeof input.amplitudeScale === "string" &&
    ["linear", "logarithmic", "db"].includes(input.amplitudeScale)
  )
    result.amplitudeScale = input.amplitudeScale as AmplitudeScale;

  if (
    typeof input.frequencyScale === "string" &&
    ["linear", "logarithmic"].includes(input.frequencyScale)
  )
    result.frequencyScale = input.frequencyScale as FrequencyScale;

  if (
    typeof input.resolution === "string" &&
    ["low", "medium", "high"].includes(input.resolution)
  )
    result.resolution = input.resolution as Resolution;

  if (
    typeof input.refreshRate === "number" &&
    [30, 60].includes(input.refreshRate)
  )
    result.refreshRate = input.refreshRate as RefreshRate;

  if (typeof input.colormap === "string") result.colormap = input.colormap;

  if (typeof input.showLegend === "boolean")
    result.showLegend = input.showLegend;

  if (typeof input.enableToastNotifications === "boolean")
    result.enableToastNotifications = input.enableToastNotifications;

  // Seekbar settings
  if (typeof input.seekPlayedColor === "string")
    result.seekPlayedColor = sanitiseColor(input.seekPlayedColor);

  if (typeof input.seekUnplayedColor === "string")
    result.seekUnplayedColor = sanitiseColor(input.seekUnplayedColor);

  if (typeof input.seekPlayheadColor === "string")
    result.seekPlayheadColor = sanitiseColor(input.seekPlayheadColor);

  if (typeof input.showSeekbarPlayhead === "boolean")
    result.showSeekbarPlayhead = input.showSeekbarPlayhead;

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

  // API Keys
  if (typeof input.apiKeys === "object" && input.apiKeys) {
    result.apiKeys = {
      acoustid:
        typeof input.apiKeys.acoustid === "string"
          ? input.apiKeys.acoustid
          : "",
      musicbrainz:
        typeof input.apiKeys.musicbrainz === "string"
          ? input.apiKeys.musicbrainz
          : "",
    };
  }

  if (typeof input.apiKeyStatus === "object" && input.apiKeyStatus) {
    result.apiKeyStatus = {
      acoustid: {
        valid:
          typeof input.apiKeyStatus.acoustid?.valid === "boolean"
            ? input.apiKeyStatus.acoustid.valid
            : false,
        lastChecked: input.apiKeyStatus.acoustid?.lastChecked
          ? new Date(input.apiKeyStatus.acoustid.lastChecked)
          : undefined,
      },
      musicbrainz: {
        valid:
          typeof input.apiKeyStatus.musicbrainz?.valid === "boolean"
            ? input.apiKeyStatus.musicbrainz.valid
            : false,
        lastChecked: input.apiKeyStatus.musicbrainz?.lastChecked
          ? new Date(input.apiKeyStatus.musicbrainz.lastChecked)
          : undefined,
      },
    };
  }

  // Artwork settings
  if (typeof input.enableExternalArtwork === "boolean")
    result.enableExternalArtwork = input.enableExternalArtwork;

  if (typeof input.enableAcoustID === "boolean")
    result.enableAcoustID = input.enableAcoustID;

  if (typeof input.enableMusicBrainz === "boolean")
    result.enableMusicBrainz = input.enableMusicBrainz;

  if (typeof input.enablePlaceholderArtwork === "boolean")
    result.enablePlaceholderArtwork = input.enablePlaceholderArtwork;

  // LUT settings
  if (
    typeof input.lutMode === "string" &&
    ["builtin", "custom", "file"].includes(input.lutMode)
  )
    result.lutMode = input.lutMode as LUTMode;

  if (input.currentLUT && typeof input.currentLUT === "object")
    result.currentLUT = input.currentLUT as LUT;

  if (Array.isArray(input.customLUTs))
    result.customLUTs = input.customLUTs.filter(
      (lut) =>
        lut &&
        typeof lut === "object" &&
        typeof lut.id === "string" &&
        typeof lut.name === "string" &&
        Array.isArray(lut.entries),
    ) as LUT[];

  return result;
}

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    ...defaultSettings,

    setTheme: (theme) => set((state) => ({ ...state, theme })),
    setAmplitudeScale: (amplitudeScale) =>
      set((state) => ({ ...state, amplitudeScale })),
    setFrequencyScale: (frequencyScale) =>
      set((state) => ({ ...state, frequencyScale })),
    setResolution: (resolution) => set((state) => ({ ...state, resolution })),
    setRefreshRate: (refreshRate) =>
      set((state) => ({ ...state, refreshRate })),
    setColormap: (colormap) => set((state) => ({ ...state, colormap })),
    setShowLegend: (showLegend) => set((state) => ({ ...state, showLegend })),
    setEnableToastNotifications: (enableToastNotifications) =>
      set((state) => ({ ...state, enableToastNotifications })),
    // Store colour overrides individually to avoid unnecessary object copies.
    setSeekPlayedColor: (color) =>
      set((state) => ({ ...state, seekPlayedColor: sanitiseColor(color) })),
    setSeekUnplayedColor: (color) =>
      set((state) => ({ ...state, seekUnplayedColor: sanitiseColor(color) })),
    setSeekPlayheadColor: (color) =>
      set((state) => ({ ...state, seekPlayheadColor: sanitiseColor(color) })),
    setShowSeekbarPlayhead: (show) =>
      set((state) => ({ ...state, showSeekbarPlayhead: show })),
    // Reset both colours back to theme-driven defaults in one cheap update.
    resetSeekbarColors: () =>
      set((state) => ({
        ...state,
        seekPlayedColor: "",
        seekUnplayedColor: "",
        seekPlayheadColor: "",
      })),

    // Seek bar configuration setters with basic validation to fail fast on
    // invalid input. Each setter clamps or verifies inputs instead of silently
    // accepting broken values that could later crash rendering code.
    setSeekbarMode: (seekbarMode) => {
      if (!VALID_SEEKBAR_MODES.includes(seekbarMode as any)) {
        console.error("invalid seekbar mode", seekbarMode);
        throw new Error("invalid seekbar mode");
      }
      set((state) => ({ ...state, seekbarMode }));
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
      set((state) => ({ ...state, seekbarSignificance: level }));
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
      set((state) => ({ ...state, seekbarAmplitudeScale }));
    },

    updateSettings: (settings) => {
      // For partial updates, we need to merge with existing state
      set((state) => {
        const sanitised = sanitiseSettings({ ...state, ...settings });
        return sanitised;
      });
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
      set((state) => ({ ...state, enableExternalArtwork: enable })),
    setEnableAcoustID: (enable) =>
      set((state) => ({ ...state, enableAcoustID: enable })),
    setEnableMusicBrainz: (enable) =>
      set((state) => ({ ...state, enableMusicBrainz: enable })),
    setEnablePlaceholderArtwork: (enable) =>
      set((state) => ({ ...state, enablePlaceholderArtwork: enable })),

    // LUT actions
    setLUTMode: (mode) => set((state) => ({ ...state, lutMode: mode })),

    setCurrentLUT: (lut) => set((state) => ({ ...state, currentLUT: lut })),

    addCustomLUT: (lut) =>
      set((state) => ({
        ...state,
        customLUTs: [...state.customLUTs, lut],
      })),

    removeCustomLUT: (id) =>
      set((state) => ({
        ...state,
        customLUTs: state.customLUTs.filter((l) => l.id !== id),
      })),

    updateCustomLUT: (id, updates) =>
      set((state) => ({
        ...state,
        customLUTs: state.customLUTs.map((l) =>
          l.id === id ? { ...l, ...updates } : l,
        ),
      })),
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
