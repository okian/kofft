import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SpectrogramCanvas,
  SpectrogramCanvasRef,
  FALLBACK_MAX_CANVAS_SIZE
} from '../spectrogram/SpectrogramCanvas'

vi.mock('../../shared/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    theme: 'japanese-a-light',
    amplitudeScale: 'linear',
    refreshRate: 60
  })
}))

describe('SpectrogramCanvas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0)
    ;(global as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
  })

  it('clamps canvas size to device limit on resize', () => {
    const ref = createRef<SpectrogramCanvasRef>()
    render(<SpectrogramCanvas ref={ref} />)
    const canvas = ref.current?.getCanvas() as HTMLCanvasElement
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      width: FALLBACK_MAX_CANVAS_SIZE * 2,
      height: FALLBACK_MAX_CANVAS_SIZE * 2,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0
    } as DOMRect)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ref.current?.resize()
    expect(canvas.width).toBe(FALLBACK_MAX_CANVAS_SIZE)
    expect(canvas.height).toBe(FALLBACK_MAX_CANVAS_SIZE)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('handles WebGL context loss and restoration', () => {
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null)
    const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')
    render(<SpectrogramCanvas />)
    const canvas = screen.getByTestId('spectrogram-canvas') as HTMLCanvasElement
    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(cancelSpy).toHaveBeenCalled()
    const initialCalls = getContextSpy.mock.calls.length
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(getContextSpy.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})
