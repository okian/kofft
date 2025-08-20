import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../App'

// Mock the Toaster component to avoid matchMedia issues
vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />
}))

describe('Basic App Tests', () => {
  it('should render the app without crashing', () => {
    render(<App />)
    
    // Check that the main app title is rendered
    expect(screen.getByText('Spectrogram')).toBeInTheDocument()
    
    // Check that the main spectrogram view is rendered
    expect(screen.getByText('Drop audio files here')).toBeInTheDocument()
    
    // Check that the header controls are rendered
    expect(screen.getByTestId('open-file-button')).toBeInTheDocument()
    expect(screen.getByTestId('microphone-button')).toBeInTheDocument()
    expect(screen.getByTestId('settings-button')).toBeInTheDocument()
    
    // Check that the footer controls are rendered
    expect(screen.getByTestId('play-pause-button')).toBeInTheDocument()
    expect(screen.getByTestId('stop-button')).toBeInTheDocument()
    
    // Check that the spectrogram canvas is present
    expect(screen.getByTestId('spectrogram-canvas')).toBeInTheDocument()
  })

  it('should have proper data-testid attributes', () => {
    render(<App />)
    
    // Check that all expected test IDs are present
    expect(screen.getByTestId('app-container')).toBeInTheDocument()
    expect(screen.getByTestId('spectrogram-view')).toBeInTheDocument()
    expect(screen.getByTestId('spectrogram-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
    expect(screen.getByTestId('file-input')).toBeInTheDocument()
  })

  it('should show initial state correctly', () => {
    render(<App />)
    
    // Check that time displays show 0:00 initially
    expect(screen.getByTestId('current-time')).toHaveTextContent('0:00')
    expect(screen.getByTestId('total-duration')).toHaveTextContent('0:00')
    
    // Check that play button is disabled initially
    const playButton = screen.getByTestId('play-pause-button')
    expect(playButton).toBeDisabled()
  })
})
