import { Theme } from '@/types'
import { cn } from '@/shared/utils/cn'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { BUILTIN_LUTS, mapValueToColor } from '@/shared/utils/lut'

interface SpectrogramLegendProps {
  theme: Theme
  className?: string
}

export function SpectrogramLegend({ theme, className }: SpectrogramLegendProps) {
  const { lutMode, currentLUT, colormap } = useSettingsStore()

  const getCurrentLUT = () => {
    if (lutMode === 'custom' && currentLUT) {
      return currentLUT
    }
    return BUILTIN_LUTS[colormap] || BUILTIN_LUTS['viridis']
  }

  const generateGradient = () => {
    const lut = getCurrentLUT()
    const colors: string[] = []
    
    // Generate 6 color stops for the gradient
    for (let i = 0; i < 6; i++) {
      const value = i / 5 // 0 to 1
      const color = mapValueToColor(value, lut)
      const hexColor = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`
      colors.push(hexColor)
    }
    
    return `linear-gradient(to bottom, ${colors.join(', ')})`
  }

  const gradient = generateGradient()

  return (
    <div 
      className={cn(
        'panel p-2',
        'w-8 h-32',
        'flex flex-col items-center',
        className
      )}
      data-testid="spectrogram-legend"
    >
      {/* Color gradient */}
      <div 
        className="w-4 h-24 rounded-sm mb-2"
        style={{ background: gradient }}
      />
      
      {/* Labels */}
      <div className="flex flex-col justify-between h-24 text-xs text-neutral-400">
        <span>0 dB</span>
        <span>-20 dB</span>
        <span>-40 dB</span>
        <span>-60 dB</span>
        <span>-80 dB</span>
      </div>
    </div>
  )
}
