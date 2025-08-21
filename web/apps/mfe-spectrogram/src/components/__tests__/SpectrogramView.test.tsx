import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpectrogramView } from '../spectrogram/SpectrogramView'

// Mock the hooks
vi.mock('../../hooks/useAudioFile', () => ({
  useAudioFile: () => ({
    isLoading: false,
    error: null,
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
  })
}))

vi.mock('../../hooks/useMicrophone', () => ({
  useMicrophone: () => ({
    startMicrophone: vi.fn(),
    stopMicrophone: vi.fn(),
    isInitialized: false,
    isRequestingPermission: false,
    error: null,
  })
}))

vi.mock('../../shared/stores/audioStore', () => ({
  useAudioStore: () => ({
    currentTrack: null,
    isPlaying: false,
    isStopped: true,
    isLive: false,
    isMicrophoneActive: false,
  })
}))

vi.mock('../../shared/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    showLegend: true,
    theme: 'dark',
  })
}))

// Mock WebGL context
const mockWebGLContext = {
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  useProgram: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  getAttribLocation: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
  drawArrays: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
  viewport: vi.fn(),
}

describe('SpectrogramView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockWebGLContext as any)
  })

  it('renders spectrogram canvas', () => {
    render(<SpectrogramView />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('shows drop zone when no track is loaded', () => {
    render(<SpectrogramView />)
    expect(screen.getByText('Drop audio files here')).toBeInTheDocument()
  })
})
