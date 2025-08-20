import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsPanel } from '../layout/SettingsPanel'

const mockSettings = {
  theme: 'dark' as const,
  amplitudeScale: 'db' as const,
  frequencyScale: 'logarithmic' as const,
  resolution: 'medium' as const,
  refreshRate: 60 as const,
  colormap: 'viridis',
  showLegend: true,
}

const mockOnSettingsChange = vi.fn()
const mockOnClose = vi.fn()

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders when open', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={false}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('renders all theme options', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Neon')).toBeInTheDocument()
    expect(screen.getByText('High Contrast')).toBeInTheDocument()
  })

  it('handles theme selection', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    const lightThemeButton = screen.getByText('Light')
    fireEvent.click(lightThemeButton)
    
    expect(mockOnSettingsChange).toHaveBeenCalledWith({ theme: 'light' })
  })

  it('handles amplitude scale change', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    const amplitudeScaleSection = screen.getByText('Amplitude Scale').closest('div')
    const linearRadio = within(amplitudeScaleSection!).getByDisplayValue('linear')
    fireEvent.click(linearRadio)
    
    expect(mockOnSettingsChange).toHaveBeenCalledWith({ amplitudeScale: 'linear' })
  })

  it('handles legend toggle', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    const legendCheckbox = screen.getByRole('checkbox')
    fireEvent.click(legendCheckbox)
    
    expect(mockOnSettingsChange).toHaveBeenCalledWith({ showLegend: false })
  })

  it('handles close button', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    const closeButton = screen.getByTitle('Close (Esc)')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles reset to defaults', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />
    )
    
    const resetButton = screen.getByText('Reset to Defaults')
    fireEvent.click(resetButton)
    
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      theme: 'dark',
      amplitudeScale: 'db',
      frequencyScale: 'logarithmic',
      resolution: 'medium',
      refreshRate: 60,
      colormap: 'viridis',
      showLegend: true,
    })
  })
})
