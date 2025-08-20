import { describe, it, expect, beforeEach, vi } from "vitest";

// Match the key used in the store. Keeping it in a constant prevents
// typos and mirrors production code.
const PERSISTENCE_KEY = "audio-preferences";

// Helper to load a fresh store instance after manipulating
// localStorage. vitest's module cache is reset to ensure the store
// re-reads persisted values.
const initStore = async (
  persisted?: { shuffle?: boolean; loopMode?: string }
) => {
  vi.resetModules();
  if (persisted) {
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(persisted));
  }
  return await import("../audioStore");
};

describe("audioStore preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updates shuffle and persists", async () => {
    const { useAudioStore, selectShuffle } = await initStore();
    const setItemSpy = vi.spyOn(localStorage, "setItem");
    useAudioStore.getState().setShuffle(true);
    expect(selectShuffle(useAudioStore.getState())).toBe(true);
    expect(setItemSpy).toHaveBeenCalledWith(
      PERSISTENCE_KEY,
      JSON.stringify({ shuffle: true, loopMode: "off" })
    );
  });

  it("updates loopMode and persists", async () => {
    const { useAudioStore, selectLoopMode } = await initStore();
    const setItemSpy = vi.spyOn(localStorage, "setItem");
    useAudioStore.getState().setLoopMode("all");
    expect(selectLoopMode(useAudioStore.getState())).toBe("all");
    expect(setItemSpy).toHaveBeenCalledWith(
      PERSISTENCE_KEY,
      JSON.stringify({ shuffle: false, loopMode: "all" })
    );
  });

  it("validates persisted settings", async () => {
    const { __loadPersistedPreferencesForTest } = await initStore();

    // Invalid JSON results in defaults
    localStorage.setItem(PERSISTENCE_KEY, "{ notjson");
    expect(__loadPersistedPreferencesForTest()).toEqual({
      shuffle: false,
      loopMode: "off",
    });

    // Invalid value types also fall back to defaults
    localStorage.setItem(
      PERSISTENCE_KEY,
      JSON.stringify({ shuffle: "yes", loopMode: "maybe" })
    );
    expect(__loadPersistedPreferencesForTest()).toEqual({
      shuffle: false,
      loopMode: "off",
    });
  });
});
