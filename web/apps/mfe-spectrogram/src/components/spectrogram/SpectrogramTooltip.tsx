import { SpectrogramEvent } from '@/types'
import { cn } from '@/shared/utils/cn'

interface SpectrogramTooltipProps {
  event: SpectrogramEvent
  className?: string
}

export function SpectrogramTooltip({ event, className }: SpectrogramTooltipProps) {
  if (!event || (!event.frequency && !event.time && !event.intensity)) {
    return null
  }

  const formatFrequency = (freq: number) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)} kHz`
    }
    return `${Math.round(freq)} Hz`
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatIntensity = (intensity: number) => {
    return `${intensity.toFixed(1)} dB`
  }

  return (
    <div 
      className={cn(
        'panel p-2 text-xs',
        'bg-neutral-900/90 backdrop-blur-sm',
        'border border-neutral-700',
        'shadow-medium',
        'pointer-events-none',
        'animate-fade-in',
        className
      )}
      style={{
        left: (event.position?.x ?? 0) + 10,
        top: (event.position?.y ?? 0) - 10,
        transform: 'translateY(-100%)',
      }}
    >
      {event.frequency !== undefined && event.frequency !== null && (
        <div className="mb-1">
          <span className="text-neutral-400">Freq: </span>
          <span className="text-neutral-100">{formatFrequency(event.frequency)}</span>
        </div>
      )}
      
      {event.time !== undefined && event.time !== null && (
        <div className="mb-1">
          <span className="text-neutral-400">Time: </span>
          <span className="text-neutral-100">{formatTime(event.time)}</span>
        </div>
      )}
      
      {event.intensity !== undefined && event.intensity !== null && (
        <div>
          <span className="text-neutral-400">Level: </span>
          <span className="text-neutral-100">{formatIntensity(event.intensity)}</span>
        </div>
      )}
    </div>
  )
}
