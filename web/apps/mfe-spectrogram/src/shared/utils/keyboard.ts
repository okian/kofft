import { KeyboardShortcuts } from "@/types";

/**
 * Key used to persist shortcuts in localStorage. Centralizing avoids
 * duplication and keeps storage access consistent.
 */
export const SHORTCUTS_STORAGE_KEY = "spectrogram-shortcuts";

/**
 * Default mapping from application actions to keyboard combinations.
 * These serve as a baseline and are merged with any user overrides.
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  playPause: " ",
  seekBackward: "ArrowLeft",
  seekForward: "ArrowRight",
  rewind: "j",
  fastForward: "l",
  previousTrack: "Control+ArrowLeft",
  nextTrack: "Control+ArrowRight",
  toggleMetadata: "i",
  togglePlaylist: "p",
  openSettings: "s",
  snapshot: "Control+Shift+s",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  mute: "m",
  help: "?",
};

/**
 * Split a shortcut string like "Ctrl+S" into normalized, trimmed parts.
 * Meta key aliases (cmd, command) are mapped to `meta` for consistency.
 */
export function parseKeyCombo(combo: string): string[] {
  return combo
    .toLowerCase()
    .split("+")
    .map((key) => {
      const trimmed = key.trim();
      switch (trimmed) {
        case "cmd":
        case "command":
          return "meta";
        case "ctrl":
          return "control";
        default:
          return trimmed;
      }
    });
}

/**
 * Determine whether the provided keyboard event matches the shortcut.
 * Modifier keys are tracked explicitly to differentiate control/meta.
 */
export function isKeyComboPressed(
  event: KeyboardEvent,
  combo: string,
): boolean {
  const keys = parseKeyCombo(combo);
  const pressedKeys = new Set<string>();

  // Add modifier keys separately for clarity
  if (event.ctrlKey) pressedKeys.add("control");
  if (event.metaKey) pressedKeys.add("meta");
  if (event.shiftKey) pressedKeys.add("shift");
  if (event.altKey) pressedKeys.add("alt");

  // Add the main key
  pressedKeys.add(event.key.toLowerCase());

  // Check if all required keys are pressed
  return keys.every((key) => pressedKeys.has(key));
}

/**
 * Create a keydown event handler that maps shortcuts to actions.
 * Input elements are ignored to avoid interfering with typing.
 */
export function createKeyboardHandler(
  shortcuts: KeyboardShortcuts,
  handlers: Record<string, () => void>,
) {
  return (event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    // Check each shortcut
    Object.entries(shortcuts).forEach(([action, combo]) => {
      if (isKeyComboPressed(event, combo)) {
        event.preventDefault();
        const handler = handlers[action];
        if (handler) {
          handler();
        }
      }
    });
  };
}

/**
 * Present a keyboard shortcut in a user-friendly format, e.g. "Ctrl + S".
 */
export function getShortcutDisplay(combo: string): string {
  return combo
    .split("+")
    .map((key) => {
      const lower = key.toLowerCase().trim();
      switch (lower) {
        case "control":
          return "Ctrl";
        case "meta":
          return "Meta";
        case "alt":
          return "Alt";
        case "shift":
          return "Shift";
        default:
          return key.charAt(0).toUpperCase() + key.slice(1);
      }
    })
    .join(" + ");
}

/**
 * Persist shortcuts to localStorage. Errors are logged and rethrown so callers
 * can react appropriately, while avoiding silent data loss.
 */
export function saveShortcuts(shortcuts: KeyboardShortcuts): void {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error("Failed to save shortcuts", error);
    throw error;
  }
}

/**
 * Load shortcuts from localStorage, merging them with defaults.
 * Invalid JSON or storage errors result in the defaults being returned.
 */
export function loadShortcuts(): KeyboardShortcuts {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load shortcuts", error);
  }
  return DEFAULT_SHORTCUTS;
}
