import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '../layout/Header'

// Mock the hooks
vi.mock('../../hooks/useAudioFile', () => ({
  useAudioFile: () => ({
    loadAudioFile: vi.fn(),
    loadMultipleFiles: vi.fn(),
  }),
}))

vi.mock('../../hooks/useMicrophone', () => ({
  useMicrophone: () => ({
    startMicrophone: vi.fn(),
    stopMicrophone: vi.fn(),
    toggleMicrophone: vi.fn(),
    isInitialized: false,
    isRequestingPermission: false,
    error: null,
  }),
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({}),
}))

describe('Header', () => {
  it('renders the app title', () => {
    render(<Header />)
    expect(screen.getByText('Spectrogram')).toBeInTheDocument()
  })

  it('renders all control buttons', () => {
    render(<Header />)
    
    expect(screen.getByTitle('Open audio file (O)')).toBeInTheDocument()
    expect(screen.getByTitle('Toggle microphone (M)')).toBeInTheDocument()
    expect(screen.getByTitle('Settings (S)')).toBeInTheDocument()
    expect(screen.getByTitle('Take snapshot (Ctrl+Shift+S)')).toBeInTheDocument()
  })

  it('has hidden file input', () => {
    render(<Header />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveClass('hidden')
  })

  it('handles file button click', () => {
    render(<Header />)
    const fileButton = screen.getByTitle('Open audio file (O)')
    fireEvent.click(fileButton)
    // Should trigger file input click
  })

  it('handles microphone button click', async () => {
    render(<Header />)
    const micButton = screen.getByTitle('Toggle microphone (M)')
    fireEvent.click(micButton)
    // Should toggle microphone
  })

  it('handles settings button click', () => {
    render(<Header />)
    const settingsButton = screen.getByTitle('Settings (S)')
    fireEvent.click(settingsButton)
    // Should open settings panel
  })

  it('handles snapshot button click', () => {
    render(<Header />)
    const snapshotButton = screen.getByTitle('Take snapshot (Ctrl+Shift+S)')
    fireEvent.click(snapshotButton)
    // Should show success toast
  })
})
