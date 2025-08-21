import { KeyboardShortcuts } from '@/types'

/**
 * LocalStorage key for persisting user-defined keyboard shortcuts.
 */
export const SHORTCUTS_STORAGE_KEY = 'spectrogram-shortcuts'

/**
 * Default key bindings for the spectrogram application.
 * Each property maps an action to the key combination that triggers it.
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  playPause: ' ',
  seekBackward: 'ArrowLeft',
  seekForward: 'ArrowRight',
  rewind: 'j',
  fastForward: 'l',
  previousTrack: 'Control+ArrowLeft',
  nextTrack: 'Control+ArrowRight',
  toggleMetadata: 'i',
  togglePlaylist: 'p',
  openSettings: 's',
  snapshot: 'Control+Shift+s',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  mute: 'm',
  help: '?',
}

/**
 * Breaks a combination string like "Control+S" into normalized key names.
 * Common aliases for the meta key (Cmd, Command) are converted to "meta".
 * @param combo Combination string to parse.
 * @returns Array of normalized key names.
 */
export function parseKeyCombo(combo: string): string[] {
  return combo
    .toLowerCase()
    .split('+')
    .map(key => {
      const trimmed = key.trim()
      return trimmed === 'cmd' || trimmed === 'command' ? 'meta' : trimmed
    })
}

/**
 * Determines whether a keyboard event matches the provided key combination.
 * Additional modifier keys beyond those specified in the combo are ignored.
 * @param event Keyboard event to inspect.
 * @param combo Key combination such as "Control+S".
 */
export function isKeyComboPressed(event: KeyboardEvent, combo: string): boolean {
  const keys = parseKeyCombo(combo)
  const pressedKeys = new Set<string>()

  // Add modifier keys
  if (event.ctrlKey) pressedKeys.add('control')
  if (event.metaKey) pressedKeys.add('meta')
  if (event.shiftKey) pressedKeys.add('shift')
  if (event.altKey) pressedKeys.add('alt')

  // Add the main key
  pressedKeys.add(event.key.toLowerCase())

  // Check if all required keys are pressed
  return keys.every(key => pressedKeys.has(key))
}

/**
 * Creates a handler that invokes callbacks when configured shortcuts are pressed.
 * Events originating from text input elements are ignored to avoid interference.
 * @param shortcuts Mapping of actions to key combinations.
 * @param handlers Mapping of actions to functions that handle the shortcut.
 */
export function createKeyboardHandler(
  shortcuts: KeyboardShortcuts,
  handlers: Record<string, () => void>
) {
  return (event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return
    }

    // Check each shortcut
    Object.entries(shortcuts).forEach(([action, combo]) => {
      if (isKeyComboPressed(event, combo)) {
        event.preventDefault()
        const handler = handlers[action]
        if (handler) {
          handler()
        }
      }
    })
  }
}

/**
 * Formats a key combination for display by capitalizing each key name.
 * @param combo Combination string to format.
 */
export function getShortcutDisplay(combo: string): string {
  return combo
    .split('+')
    .map(key => key.charAt(0).toUpperCase() + key.slice(1))
    .join(' + ')
}

/**
 * Persists keyboard shortcut mappings to LocalStorage.
 * Logs failures for easier debugging.
 * @param shortcuts Shortcut mapping to store.
 */
export function saveShortcuts(shortcuts: KeyboardShortcuts): void {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts))
  } catch (error) {
    console.error('Failed to save shortcuts', error)
  }
}

/**
 * Retrieves shortcut mappings from LocalStorage, falling back to defaults.
 * Logs failures for diagnostic purposes.
 * @returns Merged shortcut mapping.
 */
export function loadShortcuts(): KeyboardShortcuts {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Failed to load shortcuts', error)
  }
  return DEFAULT_SHORTCUTS
}
