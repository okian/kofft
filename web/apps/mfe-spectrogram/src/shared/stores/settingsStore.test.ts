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
    expect(state.seekbarAmplitudeScale).toBe(1);
    expect(state.seekPlayedColor).toBe("");
  });
});
