import { create } from 'zustand'
import { SpectrogramCanvasRef } from '@/features/spectrogram/SpectrogramCanvas'

interface SpectrogramStore {
  canvasRef: SpectrogramCanvasRef | null
  setCanvasRef: (ref: SpectrogramCanvasRef | null) => void
  addTestData: (data: Uint8Array) => void
}

export const useSpectrogramStore = create<SpectrogramStore>((set, get) => ({
  canvasRef: null,
  setCanvasRef: (ref) => {
    console.log('SpectrogramStore: Setting canvas ref:', ref ? 'available' : 'null')
    set({ canvasRef: ref })
  },
  addTestData: (data) => {
    const { canvasRef } = get()
    if (canvasRef) {
      console.log('SpectrogramStore: Adding test data to canvas')
      canvasRef.addFrame(data)
    } else {
      console.warn('SpectrogramStore: No canvas ref available')
    }
  }
}))
