import React, { useState } from "react";
import {
  X,
  Palette,
  Sliders,
  Monitor,
  Zap,
  Key,
  Image,
  Check,
  AlertCircle,
  Loader2,
  Database,
  BarChart,
  ChevronDown,
  ChevronRight,
  Volume2,
  Eye,
  Settings,
  Play,
} from "lucide-react";
import {
  SpectrogramSettings,
  Theme,
  AmplitudeScale,
  FrequencyScale,
  Resolution,
  RefreshRate,
} from "@/shared/types";
import { THEME_COLORS } from "@/shared/theme";
import { cn } from "@/utils/cn";
import { conditionalToast, directToast } from "@/utils/toast";
import { MetadataStorePanel } from "./MetadataStorePanel";
import { StatisticsPanel } from "./StatisticsPanel";
import { LUTSettingsPanel } from "@/features/settings/LUTSettingsPanel";
import { getPanelClasses } from "@/shared/layout";

interface SettingsPanelProps {
  settings: SpectrogramSettings;
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: Partial<SpectrogramSettings>) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-neutral-700 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-neutral-100">{title}</span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && <div className="p-3 pt-0 space-y-3">{children}</div>}
    </div>
  );
}

export function SettingsPanel({
  settings,
  isOpen,
  onClose,
  onSettingsChange,
}: SettingsPanelProps) {
  const [validatingKeys, setValidatingKeys] = useState<{
    [key: string]: boolean;
  }>({});
  const [activeTab, setActiveTab] = useState<
    "general" | "artwork" | "api" | "database" | "stats" | "lut"
  >("general");

  if (!isOpen) return null;

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: "Dark", icon: <Palette size={16} /> },
    { value: "light", label: "Light", icon: <Monitor size={16} /> },
    { value: "neon", label: "Neon", icon: <Zap size={16} /> },
    {
      value: "high-contrast",
      label: "High Contrast",
      icon: <Sliders size={16} />,
    },
  ];

  const amplitudeScales: { value: AmplitudeScale; label: string }[] = [
    { value: "linear", label: "Linear" },
    { value: "logarithmic", label: "Logarithmic" },
    { value: "db", label: "Decibels (dB)" },
  ];

  const frequencyScales: { value: FrequencyScale; label: string }[] = [
    { value: "linear", label: "Linear" },
    { value: "logarithmic", label: "Logarithmic" },
  ];

  const resolutions: { value: Resolution; label: string }[] = [
    { value: "low", label: "Low (Fast)" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High (Detailed)" },
  ];

  const refreshRates: { value: RefreshRate; label: string }[] = [
    { value: 30, label: "30 FPS" },
    { value: 60, label: "60 FPS" },
  ];

  // Theme-aware seekbar colour values
  const themeColours = THEME_COLORS[settings.theme];
  const playedColour = settings.seekPlayedColor || themeColours.accent;
  const unplayedColour = settings.seekUnplayedColor || themeColours.primary;
  const playheadColour = settings.seekPlayheadColor || themeColours.accent;

  const handleAPIKeyChange = (
    service: "acoustid" | "musicbrainz",
    key: string,
  ) => {
    onSettingsChange({
      apiKeys: { ...settings.apiKeys, [service]: key },
    });
  };

  const validateAPIKey = async (service: "acoustid" | "musicbrainz") => {
    setValidatingKeys((prev) => ({ ...prev, [service]: true }));

    try {
      const isValid = await import("@/shared/stores/settingsStore").then((module) =>
        module.useSettingsStore.getState().validateAPIKey(service),
      );

      if (isValid) {
        onSettingsChange({
          apiKeyStatus: {
            ...settings.apiKeyStatus,
            [service]: { valid: true, lastChecked: new Date() },
          },
        });
      }
    } catch (error) {
      console.error("API key validation failed", error);
      conditionalToast.error(
        "API key validation failed. Please verify the key and network connection.",
      );
    } finally {
      setValidatingKeys((prev) => ({ ...prev, [service]: false }));
    }
  };

  const getAPIKeyStatusIcon = (service: "acoustid" | "musicbrainz") => {
    const status = settings.apiKeyStatus[service];

    if (validatingKeys[service]) {
      return <Loader2 size={16} className="animate-spin text-blue-500" />;
    }

    if (status.valid) {
      return <Check size={16} className="text-green-500" />;
    }

    if (settings.apiKeys[service]) {
      return <AlertCircle size={16} className="text-red-500" />;
    }

    return <AlertCircle size={16} className="text-gray-400" />;
  };

  const getAPIKeyStatusText = (service: "acoustid" | "musicbrainz") => {
    const status = settings.apiKeyStatus[service];

    if (validatingKeys[service]) {
      return "Validating...";
    }

    if (status.valid) {
      return "Valid";
    }

    if (settings.apiKeys[service]) {
      return "Invalid";
    }

    return "Not set";
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        "flex items-center justify-center",
        "bg-black/50 backdrop-blur-sm",
      )}
    >
      <div
        className={cn(
          getPanelClasses(settings.theme),
          "panel w-full max-w-4xl max-h-[90vh]",
          "animate-scale-in",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-100">Settings</h3>
          <button onClick={onClose} className="icon-btn" title="Close (Esc)">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "general"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("artwork")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "artwork"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <Image size={16} className="inline mr-2" />
            Artwork
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "api"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <Key size={16} className="inline mr-2" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "stats"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <BarChart size={16} className="inline mr-2" />
            Statistics
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "database"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <Database size={16} className="inline mr-2" />
            Database
          </button>
          <button
            onClick={() => setActiveTab("lut")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "lut"
                ? "text-accent-blue border-b-2 border-accent-blue"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <Palette size={16} className="inline mr-2" />
            Color Maps
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Theme Selection */}
              <CollapsibleSection title="Appearance" icon={<Palette size={16} />}>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => onSettingsChange({ theme: theme.value })}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border text-sm",
                        "transition-colors",
                        settings.theme === theme.value
                          ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                          : "border-neutral-700 hover:border-neutral-600 text-neutral-300",
                      )}
                    >
                      {theme.icon}
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Seekbar Settings */}
              <CollapsibleSection title="Seekbar" icon={<Play size={16} />}>
                <div className="space-y-3">
                  {/* Colors */}
                  <div>
                    <span className="block text-xs text-neutral-400 mb-2">Colors</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-neutral-300">
                        Played
                        <input
                          type="color"
                          value={playedColour}
                          onChange={(e) =>
                            onSettingsChange({ seekPlayedColor: e.target.value })
                          }
                          className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-300">
                        Unplayed
                        <input
                          type="color"
                          value={unplayedColour}
                          onChange={(e) =>
                            onSettingsChange({ seekUnplayedColor: e.target.value })
                          }
                          className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-300">
                        Playhead
                        <input
                          type="color"
                          value={playheadColour}
                          onChange={(e) =>
                            onSettingsChange({ seekPlayheadColor: e.target.value })
                          }
                          className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded"
                        />
                      </label>
                      <button
                        onClick={() =>
                          onSettingsChange({
                            seekPlayedColor: "",
                            seekUnplayedColor: "",
                            seekPlayheadColor: "",
                          })
                        }
                        className="px-2 py-1 text-xs text-accent-blue border border-accent-blue rounded hover:bg-accent-blue/10"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Visualisation */}
                  <div>
                    <span className="block text-xs text-neutral-400 mb-2">Visualisation</span>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "live", label: "Live Audio" },
                        { value: "frequency", label: "Animated Frequency Bars" },
                        { value: "waveform", label: "Fixed Waveform" },
                      ].map((m) => (
                        <label
                          key={m.value}
                          className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="seekbarMode"
                            value={m.value}
                            checked={settings.seekbarMode === m.value}
                            onChange={(e) =>
                              onSettingsChange({
                                seekbarMode: e.target.value as any,
                              })
                            }
                            className="text-accent-blue"
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs text-neutral-400 mb-1">Significance</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={settings.seekbarSignificance}
                        onChange={(e) =>
                          onSettingsChange({
                            seekbarSignificance: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <span className="text-xs text-neutral-500">{settings.seekbarSignificance}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-neutral-400 mb-1">Amplitude Scale</span>
                      <input
                        type="range"
                        min={0.1}
                        max={20}
                        step={0.1}
                        value={settings.seekbarAmplitudeScale}
                        onChange={(e) =>
                          onSettingsChange({
                            seekbarAmplitudeScale: parseFloat(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <span className="text-xs text-neutral-500">{settings.seekbarAmplitudeScale}</span>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showSeekbarPlayhead ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          showSeekbarPlayhead: e.target.checked,
                        })
                      }
                      className="text-accent-blue"
                    />
                    Show playhead (progress line)
                  </label>
                </div>
              </CollapsibleSection>

              {/* Spectrogram Settings */}
              <CollapsibleSection title="Spectrogram" icon={<BarChart size={16} />}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs text-neutral-400 mb-2">Amplitude Scale</span>
                      <div className="space-y-1">
                        {amplitudeScales.map((scale) => (
                          <label
                            key={scale.value}
                            className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="amplitudeScale"
                              value={scale.value}
                              checked={settings.amplitudeScale === scale.value}
                              onChange={(e) =>
                                onSettingsChange({
                                  amplitudeScale: e.target.value as AmplitudeScale,
                                })
                              }
                              className="text-accent-blue"
                            />
                            {scale.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs text-neutral-400 mb-2">Frequency Scale</span>
                      <div className="space-y-1">
                        {frequencyScales.map((scale) => (
                          <label
                            key={scale.value}
                            className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="frequencyScale"
                              value={scale.value}
                              checked={settings.frequencyScale === scale.value}
                              onChange={(e) =>
                                onSettingsChange({
                                  frequencyScale: e.target.value as FrequencyScale,
                                })
                              }
                              className="text-accent-blue"
                            />
                            {scale.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs text-neutral-400 mb-2">Resolution</span>
                      <div className="space-y-1">
                        {resolutions.map((resolution) => (
                          <label
                            key={resolution.value}
                            className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="resolution"
                              value={resolution.value}
                              checked={settings.resolution === resolution.value}
                              onChange={(e) =>
                                onSettingsChange({
                                  resolution: e.target.value as Resolution,
                                })
                              }
                              className="text-accent-blue"
                            />
                            {resolution.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs text-neutral-400 mb-2">Refresh Rate</span>
                      <div className="space-y-1">
                        {refreshRates.map((rate) => (
                          <label
                            key={rate.value}
                            className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="refreshRate"
                              value={rate.value}
                              checked={settings.refreshRate === rate.value}
                              onChange={(e) =>
                                onSettingsChange({
                                  refreshRate: parseInt(e.target.value) as RefreshRate,
                                })
                              }
                              className="text-accent-blue"
                            />
                            {rate.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* UI Settings */}
              <CollapsibleSection title="Interface" icon={<Eye size={16} />}>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showLegend}
                      onChange={(e) =>
                        onSettingsChange({ showLegend: e.target.checked })
                      }
                      className="text-accent-blue"
                    />
                    Show Legend
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableToastNotifications}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        onSettingsChange({ enableToastNotifications: enabled });
                        if (enabled) {
                          directToast.success("Toast notifications enabled");
                        }
                      }}
                      className="text-accent-blue"
                    />
                    <div>
                      <span>Toast Notifications</span>
                      <p className="text-xs text-neutral-500">Show success and error notifications</p>
                    </div>
                  </label>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === "artwork" && (
            <div className="space-y-4">
              <CollapsibleSection title="Artwork Sources" icon={<Image size={16} />}>
                <p className="text-xs text-neutral-400 mb-3">
                  Configure how album artwork is retrieved. Sources are tried in order of priority.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableExternalArtwork}
                      onChange={(e) =>
                        onSettingsChange({
                          enableExternalArtwork: e.target.checked,
                        })
                      }
                      className="text-accent-blue"
                    />
                    <div>
                      <span>Enable External Artwork</span>
                      <p className="text-xs text-neutral-500">Allow fetching artwork from online sources</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableMusicBrainz}
                      onChange={(e) =>
                        onSettingsChange({
                          enableMusicBrainz: e.target.checked,
                        })
                      }
                      disabled={!settings.enableExternalArtwork}
                      className="text-accent-blue"
                    />
                    <div>
                      <span>MusicBrainz Lookup</span>
                      <p className="text-xs text-neutral-500">Search MusicBrainz database for album artwork</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableAcoustID}
                      onChange={(e) =>
                        onSettingsChange({ enableAcoustID: e.target.checked })
                      }
                      disabled={!settings.enableExternalArtwork}
                      className="text-accent-blue"
                    />
                    <div>
                      <span>AcoustID Fingerprinting</span>
                      <p className="text-xs text-neutral-500">Use audio fingerprinting for identification (requires API key)</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enablePlaceholderArtwork}
                      onChange={(e) =>
                        onSettingsChange({
                          enablePlaceholderArtwork: e.target.checked,
                        })
                      }
                      className="text-accent-blue"
                    />
                    <div>
                      <span>Generate Placeholder Artwork</span>
                      <p className="text-xs text-neutral-500">Create unique placeholder images when no artwork is found</p>
                    </div>
                  </label>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-4">
              <CollapsibleSection title="API Keys" icon={<Key size={16} />}>
                <p className="text-xs text-neutral-400 mb-3">
                  Configure API keys for external services. Keys are stored locally and never shared.
                </p>
                <div className="space-y-3">
                  {/* AcoustID API Key */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-neutral-300">
                        AcoustID API Key
                      </label>
                      {getAPIKeyStatusIcon("acoustid")}
                      <span className="text-xs text-neutral-500">
                        {getAPIKeyStatusText("acoustid")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={settings.apiKeys.acoustid || ""}
                        onChange={(e) =>
                          handleAPIKeyChange("acoustid", e.target.value)
                        }
                        placeholder="Enter your AcoustID API key"
                        className="flex-1 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-sm text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-accent-blue"
                      />
                      <button
                        onClick={() => validateAPIKey("acoustid")}
                        disabled={
                          !settings.apiKeys.acoustid || validatingKeys.acoustid
                        }
                        className="px-3 py-2 bg-accent-blue text-white rounded text-sm hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {validatingKeys.acoustid ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Get a free API key from{" "}
                      <a
                        href="https://acoustid.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-blue hover:underline"
                      >
                        acoustid.org
                      </a>
                    </p>
                  </div>

                  {/* MusicBrainz API Key */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-neutral-300">
                        MusicBrainz API Key
                      </label>
                      {getAPIKeyStatusIcon("musicbrainz")}
                      <span className="text-xs text-neutral-500">
                        {getAPIKeyStatusText("musicbrainz")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={settings.apiKeys.musicbrainz || ""}
                        onChange={(e) =>
                          handleAPIKeyChange("musicbrainz", e.target.value)
                        }
                        placeholder="Optional - MusicBrainz works without API key"
                        className="flex-1 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-sm text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-accent-blue"
                      />
                      <button
                        onClick={() => validateAPIKey("musicbrainz")}
                        disabled={validatingKeys.musicbrainz}
                        className="px-3 py-2 bg-accent-blue text-white rounded text-sm hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {validatingKeys.musicbrainz ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      MusicBrainz is free and works without an API key, but you can register for higher rate limits
                    </p>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === "stats" && <StatisticsPanel />}

          {activeTab === "database" && <MetadataStorePanel />}

          {activeTab === "lut" && <LUTSettingsPanel />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={async () => {
              // Use the store's reset function
              const { useSettingsStore } = await import("@/shared/stores/settingsStore");
              useSettingsStore.getState().resetToDefaults();
              // Also update the local state
              onSettingsChange({});
            }}
            className="btn-secondary w-full"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
