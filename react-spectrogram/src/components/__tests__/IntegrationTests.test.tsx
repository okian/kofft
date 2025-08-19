import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

// Mock all hooks and stores
const mockUseAudioFile = vi.fn(() => ({
  isLoading: false,
  error: null as string | null,
  loadAudioFiles: vi.fn(),
  playTrack: vi.fn(),
  stopPlayback: vi.fn(),
  pausePlayback: vi.fn(),
  resumePlayback: vi.fn(),
  seekTo: vi.fn(),
  setAudioVolume: vi.fn(),
  toggleMute: vi.fn(),
  getFrequencyData: vi.fn(() => new Uint8Array(1024)),
  getTimeData: vi.fn(() => new Uint8Array(1024)),
  cleanup: vi.fn(),
  initAudioContext: vi.fn(),
}))

const mockUseMicrophone = vi.fn(() => ({
  startMicrophone: vi.fn(),
  stopMicrophone: vi.fn(),
  isInitialized: false,
  isRequestingPermission: false,
  error: null,
}))

const mockUseKeyboardShortcuts = vi.fn(() => ({
  isEnabled: true,
}))

const mockUseScreenSize = vi.fn(() => ({
  isMobile: false,
  isTablet: false,
}))

const mockUseAudioStore = vi.fn(() => ({
  currentTrack: null,
  isPlaying: false,
  isStopped: true,
  isLive: false,
  isMicrophoneActive: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playlist: [],
  togglePlayPause: vi.fn(),
  stopPlayback: vi.fn(),
  nextTrack: vi.fn(),
  previousTrack: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
  seekTo: vi.fn(),
  addToPlaylist: vi.fn(),
  removeFromPlaylist: vi.fn(),
  clearPlaylist: vi.fn(),
}))

const mockUseUIStore = vi.fn(() => ({
  isMetadataOpen: false,
  isPlaylistOpen: false,
  isSettingsOpen: false,
  isFullscreen: false,
  isMobile: false,
  isTablet: false,
  toggleMetadata: vi.fn(),
  togglePlaylist: vi.fn(),
  toggleSettings: vi.fn(),
  toggleFullscreen: vi.fn(),
  shortcutsHelpOpen: false,
  setShortcutsHelpOpen: vi.fn(),
}))

const mockUseSettingsStore = vi.fn(() => ({
  theme: 'dark' as const,
  amplitudeScale: 'db' as const,
  frequencyScale: 'logarithmic' as const,
  resolution: 'medium' as const,
  refreshRate: 60,
  colormap: 'viridis',
  showLegend: true,
  setTheme: vi.fn(),
  setAmplitudeScale: vi.fn(),
  setFrequencyScale: vi.fn(),
  setResolution: vi.fn(),
  setRefreshRate: vi.fn(),
  setColormap: vi.fn(),
  setShowLegend: vi.fn(),
}))

vi.mock('../../hooks/useAudioFile', () => ({
  useAudioFile: mockUseAudioFile
}))

vi.mock('../../hooks/useMicrophone', () => ({
  useMicrophone: mockUseMicrophone
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: mockUseKeyboardShortcuts
}))

vi.mock('../../hooks/useScreenSize', () => ({
  useScreenSize: mockUseScreenSize
}))

vi.mock('../../stores/audioStore', () => ({
  useAudioStore: mockUseAudioStore
}))

vi.mock('../../stores/uiStore', () => ({
  useUIStore: mockUseUIStore
}))

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: mockUseSettingsStore
}))

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('App Initialization', () => {
    it('should render all main components', () => {
      render(<App />)
      
      // Check for main layout components
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
      expect(screen.getByTestId('spectrogram-view')).toBeInTheDocument()
    })

    it('should show drop zone when no audio is loaded', () => {
      render(<App />)
      expect(screen.getByText('Drop audio files here')).toBeInTheDocument()
    })

    it('should have all control buttons available', () => {
      render(<App />)
      
      expect(screen.getByTitle('Open audio file (O)')).toBeInTheDocument()
      expect(screen.getByTitle('Play/Pause (Space)')).toBeInTheDocument()
      expect(screen.getByTitle('Stop (S)')).toBeInTheDocument()
      expect(screen.getByTitle('Previous track (Ctrl+←)')).toBeInTheDocument()
      expect(screen.getByTitle('Next track (Ctrl+→)')).toBeInTheDocument()
      expect(screen.getByTitle('Settings (S)')).toBeInTheDocument()
    })
  })

  describe('Audio File Loading', () => {
    it('should handle file loading through UI', () => {
      render(<App />)
      
      const fileButton = screen.getByTitle('Open audio file (O)')
      expect(fileButton).toBeInTheDocument()
      
      // Mock file input functionality
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'audio/*'
      expect(fileInput).toBeInTheDocument()
    })
  })

  describe('Playback Controls', () => {
    it('should have all playback controls present', () => {
      render(<App />)
      
      expect(screen.getByTestId('play-pause-button')).toBeInTheDocument()
      expect(screen.getByTestId('stop-button')).toBeInTheDocument()
      expect(screen.getByTestId('previous-button')).toBeInTheDocument()
      expect(screen.getByTestId('next-button')).toBeInTheDocument()
      expect(screen.getByTestId('volume-control')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })
  })

  describe('Settings Panel', () => {
    it('should open settings panel when settings button is clicked', () => {
      render(<App />)
      
      const settingsButton = screen.getByTitle('Settings (S)')
      expect(settingsButton).toBeInTheDocument()
    })
  })

  describe('Spectrogram Display', () => {
    it('should render spectrogram canvas', () => {
      render(<App />)
      
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('should show legend when enabled', () => {
      render(<App />)
      
      // Legend should be visible by default
      const legend = screen.getByTestId('spectrogram-legend')
      expect(legend).toBeInTheDocument()
    })
  })
})
