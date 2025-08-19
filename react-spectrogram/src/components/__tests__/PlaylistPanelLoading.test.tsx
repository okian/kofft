import { render, screen } from '@testing-library/react'
import { PlaylistPanel } from '../layout/PlaylistPanel'
import { describe, it, vi } from 'vitest'

vi.mock('@/hooks/useAudioFile', () => ({
  useAudioFile: () => ({ loadAudioFiles: vi.fn() })
}))

describe('PlaylistPanel loading placeholder', () => {
  it('shows spinner for loading tracks', () => {
    const track: any = {
      id: '1',
      file: new File([], 't.mp3'),
      metadata: { title: 't', artist: '', album: '', duration: 0 },
      duration: 0,
      url: '',
      isLoading: true,
    }

    render(
      <PlaylistPanel
        tracks={[track]}
        currentTrackIndex={-1}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={() => {}}
        onTrackRemove={() => {}}
        onTrackReorder={() => {}}
      />
    )

    expect(screen.getByTestId('track-loading-spinner')).toBeInTheDocument()
  })
})

describe('PlaylistPanel artwork visibility', () => {
  it('removes artwork when out of view and restores it when visible again', () => {
    const art = new Uint8Array(200).fill(1)
    const track: any = {
      id: '1',
      file: new File([], 't.mp3'),
      metadata: {
        title: 't',
        artist: '',
        album: '',
        duration: 0,
        album_art: art,
        album_art_mime: 'image/png',
      },
      duration: 0,
      url: '',
    }

    const observers: any[] = []
    const OriginalIO = globalThis.IntersectionObserver
    class MockIO {
      cb: any
      el?: Element
      constructor(cb: any) {
        this.cb = cb
        observers.push(this)
      }
      observe = (el: Element) => {
        this.el = el
      }
      unobserve = () => {}
      disconnect = () => {}
      trigger(isIntersecting: boolean) {
        this.cb([{ isIntersecting, target: this.el! }])
      }
    }
    (globalThis as any).IntersectionObserver = MockIO

    render(
      <PlaylistPanel
        tracks={[track]}
        currentTrackIndex={-1}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={() => {}}
        onTrackRemove={() => {}}
        onTrackReorder={() => {}}
      />
    )

    const img = screen.getByAltText('Album Art') as HTMLImageElement
    const observer = observers[0]

    observer.trigger(true)
    expect(img.getAttribute('src')).toContain('blob:')

    observer.trigger(false)
    expect(img.getAttribute('src')).toBeNull()

    observer.trigger(true)
    expect(img.getAttribute('src')).toContain('blob:')

    (globalThis as any).IntersectionObserver = OriginalIO
  })
})
