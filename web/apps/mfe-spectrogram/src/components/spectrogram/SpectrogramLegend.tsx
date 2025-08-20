import { Theme } from '@/types'
import { cn } from '@/utils/cn'

interface SpectrogramLegendProps {
  theme: Theme
  className?: string
}

export function SpectrogramLegend({ theme, className }: SpectrogramLegendProps) {
  const getColorMap = (theme: Theme) => {
    switch (theme) {
      case 'dark':
        return ['#000033', '#0066cc', '#00ffff', '#ffff00', '#ff6600', '#ff0000']
      case 'light':
        return ['#ffffff', '#e6f3ff', '#66ccff', '#ffcc66', '#ff9966', '#ff6666']
      case 'neon':
        return ['#000000', '#00ffff', '#00ff00', '#ffff00', '#ff00ff', '#ff0080']
      case 'high-contrast':
        return ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff']
      default:
        return ['#000033', '#0066cc', '#00ffff', '#ffff00', '#ff6600', '#ff0000']
    }
  }

  const colors = getColorMap(theme)
  const gradient = `linear-gradient(to bottom, ${colors.join(', ')})`

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
