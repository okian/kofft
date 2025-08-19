import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function useScreenSize() {
  const { updateScreenSize, isMobile, isTablet } = useUIStore()

  useEffect(() => {
    // Initial size check
    updateScreenSize()

    // Handle resize events
    const handleResize = () => {
      updateScreenSize()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [updateScreenSize])

  return { isMobile, isTablet }
}
