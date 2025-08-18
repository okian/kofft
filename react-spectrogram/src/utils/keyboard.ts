import { KeyboardShortcuts } from '@/types'

export const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  playPause: ' ',
  previousTrack: 'ArrowLeft',
  nextTrack: 'ArrowRight',
  toggleMetadata: 'm',
  togglePlaylist: 'p',
  openSettings: 's',
  snapshot: 'Control+Shift+s',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  mute: 'm',
}

export function parseKeyCombo(combo: string): string[] {
  return combo.toLowerCase().split('+').map(key => key.trim())
}

export function isKeyComboPressed(event: KeyboardEvent, combo: string): boolean {
  const keys = parseKeyCombo(combo)
  const pressedKeys = new Set<string>()
  
  // Add modifier keys
  if (event.ctrlKey || event.metaKey) pressedKeys.add('control')
  if (event.shiftKey) pressedKeys.add('shift')
  if (event.altKey) pressedKeys.add('alt')
  
  // Add the main key
  pressedKeys.add(event.key.toLowerCase())
  
  // Check if all required keys are pressed
  return keys.every(key => pressedKeys.has(key))
}

export function createKeyboardHandler(shortcuts: KeyboardShortcuts, handlers: Record<string, () => void>) {
  return (event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
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

export function getShortcutDisplay(combo: string): string {
  return combo
    .split('+')
    .map(key => key.charAt(0).toUpperCase() + key.slice(1))
    .join(' + ')
}

export function saveShortcuts(shortcuts: KeyboardShortcuts): void {
  try {
    localStorage.setItem('spectrogram-shortcuts', JSON.stringify(shortcuts))
      } catch (error) {
      // Failed to save shortcuts
    }
}

export function loadShortcuts(): KeyboardShortcuts {
  try {
    const stored = localStorage.getItem('spectrogram-shortcuts')
    if (stored) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) }
    }
  } catch (error) {
    // Failed to load shortcuts
  }
  return DEFAULT_SHORTCUTS
}
