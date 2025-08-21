// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  useSettingsStore,
  STORAGE_KEY,
  VALID_SEEKBAR_MODES,
} from "./settingsStore";

describe("settingsStore seekbar configuration", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    localStorage.clear();
  });

  it("clamps seekbarSignificance to [0,1]", () => {
    useSettingsStore.getState().setSeekbarSignificance(2);
    expect(useSettingsStore.getState().seekbarSignificance).toBe(1);
  });

  it("rejects invalid seekbar modes", () => {
    expect(() =>
      useSettingsStore.getState().setSeekbarMode("invalid" as any),
    ).toThrow();
    const mode = VALID_SEEKBAR_MODES[0];
    useSettingsStore.getState().setSeekbarMode(mode);
    expect(useSettingsStore.getState().seekbarMode).toBe(mode);
  });

  it("validates amplitude scale", () => {
    expect(() =>
      useSettingsStore.getState().setSeekbarAmplitudeScale(0),
    ).toThrow();
    useSettingsStore.getState().setSeekbarAmplitudeScale(2);
    expect(useSettingsStore.getState().seekbarAmplitudeScale).toBe(2);
  });

  it("sanitises colour overrides", () => {
    useSettingsStore.getState().setSeekPlayedColor("  #ff0000  ");
    expect(useSettingsStore.getState().seekPlayedColor).toBe("#ff0000");
    useSettingsStore.getState().setSeekPlayedColor("not-a-color");
    expect(useSettingsStore.getState().seekPlayedColor).toBe("");
  });

  it("uses a safe default theme and sanitises loaded theme", () => {
    // Default theme should be the conservative japanese-a-light palette.
    expect(useSettingsStore.getState().theme).toBe("japanese-a-light");
    // Invalid theme strings should revert to the default.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "invalid" }));
    useSettingsStore.getState().loadFromStorage();
    expect(useSettingsStore.getState().theme).toBe("japanese-a-light");
    // Supported themes should persist correctly.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "bauhaus-dark" }),
    );
    useSettingsStore.getState().loadFromStorage();
    expect(useSettingsStore.getState().theme).toBe("bauhaus-dark");
  });

  it("sets animationStyle based on theme", () => {
    useSettingsStore.getState().setTheme("japanese-a-light");
    expect(useSettingsStore.getState().animationStyle).toBe("calm");
    useSettingsStore.getState().setTheme("bauhaus-dark");
    expect(useSettingsStore.getState().animationStyle).toBe("geometric");
  });

  it("sanitises loaded settings", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        seekbarMode: "invalid",
        seekbarSignificance: 2,
        seekbarAmplitudeScale: -1,
        seekPlayedColor: "not-a-color",
      }),
    );
    useSettingsStore.getState().loadFromStorage();
    const state = useSettingsStore.getState();
    expect(state.seekbarMode).toBe("waveform");
    expect(state.seekbarSignificance).toBe(1);
    // Invalid amplitude scale falls back to default (8) rather than 1.
    expect(state.seekbarAmplitudeScale).toBe(8);
    expect(state.seekPlayedColor).toBe("");
  });
});
