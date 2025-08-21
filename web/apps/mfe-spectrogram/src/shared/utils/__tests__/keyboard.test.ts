// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseKeyCombo,
  isKeyComboPressed,
  getShortcutDisplay,
  DEFAULT_SHORTCUTS,
  saveShortcuts,
  loadShortcuts,
  SHORTCUTS_STORAGE_KEY,
} from "../keyboard";

// Ensure clean storage and mocks for each test run.
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Keyboard Utils", () => {
  describe("parseKeyCombo", () => {
    it("parses simple key combinations", () => {
      expect(parseKeyCombo("a")).toEqual(["a"]);
      expect(parseKeyCombo("space")).toEqual(["space"]);
    });

    it("parses modifier key combinations", () => {
      expect(parseKeyCombo("Control+Shift+s")).toEqual([
        "control",
        "shift",
        "s",
      ]);
      expect(parseKeyCombo("Alt+Enter")).toEqual(["alt", "enter"]);
    });

    it("handles whitespace", () => {
      expect(parseKeyCombo(" Control + Shift + S ")).toEqual([
        "control",
        "shift",
        "s",
      ]);
    });

    it("normalizes meta key aliases", () => {
      expect(parseKeyCombo("Cmd+S")).toEqual(["meta", "s"]);
      expect(parseKeyCombo("Command+S")).toEqual(["meta", "s"]);
    });
  });

  describe("isKeyComboPressed", () => {
    it("matches simple keys", () => {
      const event = new KeyboardEvent("keydown", { key: "a" });
      expect(isKeyComboPressed(event, "a")).toBe(true);
      expect(isKeyComboPressed(event, "b")).toBe(false);
    });

    it("matches modifier combinations", () => {
      const event = new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        shiftKey: true,
      });

      expect(isKeyComboPressed(event, "Control+Shift+s")).toBe(true);
      expect(isKeyComboPressed(event, "Control+s")).toBe(true); // Should match partial
      expect(isKeyComboPressed(event, "Shift+s")).toBe(true); // Should match partial
    });

    it("handles case insensitive matching", () => {
      const event = new KeyboardEvent("keydown", { key: "S" });
      expect(isKeyComboPressed(event, "s")).toBe(true);
      expect(isKeyComboPressed(event, "S")).toBe(true);
    });

    it("distinguishes control and meta keys", () => {
      const metaEvent = new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
      });
      expect(isKeyComboPressed(metaEvent, "meta+s")).toBe(true);
      expect(isKeyComboPressed(metaEvent, "control+s")).toBe(false);
    });
  });

  describe("getShortcutDisplay", () => {
    it("formats simple keys", () => {
      expect(getShortcutDisplay("a")).toBe("A");
      expect(getShortcutDisplay("space")).toBe("Space");
    });

    it("formats modifier combinations", () => {
      expect(getShortcutDisplay("Control+Shift+s")).toBe("Ctrl + Shift + S");
      expect(getShortcutDisplay("Alt+Enter")).toBe("Alt + Enter");
    });
  });

  describe("DEFAULT_SHORTCUTS", () => {
    it("has all required shortcuts", () => {
      expect(DEFAULT_SHORTCUTS.playPause).toBe(" ");
      expect(DEFAULT_SHORTCUTS.seekBackward).toBe("ArrowLeft");
      expect(DEFAULT_SHORTCUTS.seekForward).toBe("ArrowRight");
      expect(DEFAULT_SHORTCUTS.rewind).toBe("j");
      expect(DEFAULT_SHORTCUTS.fastForward).toBe("l");
      expect(DEFAULT_SHORTCUTS.previousTrack).toBe("Control+ArrowLeft");
      expect(DEFAULT_SHORTCUTS.nextTrack).toBe("Control+ArrowRight");
      expect(DEFAULT_SHORTCUTS.toggleMetadata).toBe("i");
      expect(DEFAULT_SHORTCUTS.togglePlaylist).toBe("p");
      expect(DEFAULT_SHORTCUTS.openSettings).toBe("s");
      expect(DEFAULT_SHORTCUTS.snapshot).toBe("Control+Shift+s");
      expect(DEFAULT_SHORTCUTS.volumeUp).toBe("ArrowUp");
      expect(DEFAULT_SHORTCUTS.volumeDown).toBe("ArrowDown");
      expect(DEFAULT_SHORTCUTS.mute).toBe("m");
      expect(DEFAULT_SHORTCUTS.help).toBe("?");
    });
  });

  describe("storage helpers", () => {
    it("saves and loads shortcuts using a constant key", () => {
      const custom = { ...DEFAULT_SHORTCUTS, playPause: "k" };
      saveShortcuts(custom);
      const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      expect(stored).not.toBeNull();
      const loaded = loadShortcuts();
      expect(loaded.playPause).toBe("k");
    });

    it("logs and preserves existing shortcuts when save fails", () => {
      const original = { ...DEFAULT_SHORTCUTS, playPause: "k" };
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(original));
      const error = new Error("storage-failure");
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw error;
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() =>
        saveShortcuts({ ...DEFAULT_SHORTCUTS, playPause: "x" }),
      ).toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save shortcuts",
        error,
      );
      const stored = JSON.parse(
        localStorage.getItem(SHORTCUTS_STORAGE_KEY) as string,
      );
      expect(stored.playPause).toBe("k");
    });
  });
});
