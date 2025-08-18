import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../App'

// Mock the stores and hooks
vi.mock('../../stores/audioStore', () => ({
  useAudioStore: () => ({
    currentTrack: null,
    playlist: [],
    currentTrackIndex: -1,
    playTrack: vi.fn(),
    removeFromPlaylist: vi.fn(),
    reorderPlaylist: vi.fn(),
    isPlaying: false,
    isStopped: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isLive: false,
    isMicrophoneActive: false,
  })
}))

vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({
    isMobile: false,
    metadataPanelOpen: false,
    playlistPanelOpen: true, // Playlist should be visible by default
    settingsPanelOpen: false,
    setMetadataPanelOpen: vi.fn(),
    setPlaylistPanelOpen: vi.fn(),
    setSettingsPanelOpen: vi.fn(),
  })
}))

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    theme: 'dark',
    updateSettings: vi.fn(),
  })
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

vi.mock('../../hooks/useScreenSize', () => ({
  useScreenSize: vi.fn(),
}))

vi.mock('../../utils/wasm', () => ({
  initWASM: vi.fn(),
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('app-container')).toBeInTheDocument()
  })

  it('renders header with app title', () => {
    render(<App />)
    expect(screen.getByText('Spectrogram')).toBeInTheDocument()
  })

  it('renders footer with controls', () => {
    render(<App />)
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByTestId('play-pause-button')).toBeInTheDocument()
  })

  it('renders spectrogram view', () => {
    render(<App />)
    expect(screen.getByTestId('spectrogram-view')).toBeInTheDocument()
  })

  it('shows drop zone when no track is loaded', () => {
    render(<App />)
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
    expect(screen.getByText('Drop audio files here')).toBeInTheDocument()
  })
})
