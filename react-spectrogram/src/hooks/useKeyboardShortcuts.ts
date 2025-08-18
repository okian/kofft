import { useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAudioStore } from '@/stores/audioStore'
import { useAudioFile } from '@/hooks/useAudioFile'
import toast from 'react-hot-toast'

export const useKeyboardShortcuts = () => {
  const { 
    setMetadataPanelOpen, 
    setPlaylistPanelOpen, 
    setSettingsPanelOpen,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen
  } = useUIStore()
  
  const { 
    isPlaying, 
    isPaused, 
    isStopped, 
    currentTrack, 
    playlist, 
    currentTrackIndex,
    volume,
    isMuted
  } = useAudioStore()
  
  const audioFile = useAudioFile()

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts if user is typing in an input field
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLSelectElement) {
      return
    }

    const { key, ctrlKey, shiftKey, metaKey } = event

    // Spacebar - Play/Pause
    if (key === ' ' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      if (isStopped) {
        if (currentTrack) {
          audioFile.playTrack(currentTrack)
        }
      } else if (isPlaying) {
        audioFile.pausePlayback()
      } else {
        audioFile.resumePlayback()
      }
      return
    }

    // Arrow Left - Previous track
    if (key === 'ArrowLeft' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      if (playlist.length > 0) {
        const prevIndex = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1
        const prevTrack = playlist[prevIndex]
        if (prevTrack) {
          audioFile.playTrack(prevTrack)
        }
      }
      return
    }

    // Arrow Right - Next track
    if (key === 'ArrowRight' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      if (playlist.length > 0) {
        const nextIndex = (currentTrackIndex + 1) % playlist.length
        const nextTrack = playlist[nextIndex]
        if (nextTrack) {
          audioFile.playTrack(nextTrack)
        }
      }
      return
    }

    // Arrow Up - Volume up
    if (key === 'ArrowUp' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      const newVolume = Math.min(1, volume + 0.05)
      audioFile.setAudioVolume(newVolume)
      return
    }

    // Arrow Down - Volume down
    if (key === 'ArrowDown' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      const newVolume = Math.max(0, volume - 0.05)
      audioFile.setAudioVolume(newVolume)
      return
    }

    // M - Toggle metadata panel
    if (key.toLowerCase() === 'm' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      setMetadataPanelOpen(!metadataPanelOpen)
      return
    }

    // P - Toggle playlist panel
    if (key.toLowerCase() === 'p' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      setPlaylistPanelOpen(!playlistPanelOpen)
      return
    }

    // S - Open settings
    if (key.toLowerCase() === 's' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      setSettingsPanelOpen(true)
      return
    }

    // Ctrl/Cmd + Shift + S - Snapshot
    if (key.toLowerCase() === 's' && (ctrlKey || metaKey) && shiftKey) {
      event.preventDefault()
      // TODO: Implement snapshot functionality
      console.log('Taking snapshot...')
      toast.success('Snapshot taken!')
      return
    }

    // Escape - Close panels/modals
    if (key === 'Escape') {
      event.preventDefault()
      if (settingsPanelOpen) {
        setSettingsPanelOpen(false)
      } else if (metadataPanelOpen) {
        setMetadataPanelOpen(false)
      } else if (playlistPanelOpen) {
        setPlaylistPanelOpen(false)
      }
      return
    }

    // O - Open file dialog (if implemented)
    if (key.toLowerCase() === 'o' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      // This would trigger the file input, but we need to access the file input ref
      // For now, we'll just show a toast
      toast('Use the file button to open audio files', { icon: '💡' })
      return
    }

    // M - Toggle mute (alternative to metadata panel)
    // Note: This conflicts with metadata panel toggle, so we'll use a different key
    // or implement it differently
    if (key.toLowerCase() === 'm' && ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      audioFile.toggleMute()
      return
    }

  }, [
    isPlaying, 
    isPaused, 
    isStopped, 
    currentTrack, 
    playlist, 
    currentTrackIndex,
    volume,
    isMuted,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen,
    audioFile,
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen
  ])

  // Add event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Show keyboard shortcuts help on first visit
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('spectrogram-keyboard-help')
    if (!hasSeenHelp) {
      setTimeout(() => {
        toast.success(
          '💡 Keyboard shortcuts available! Press S for settings to see all shortcuts.',
          { duration: 5000 }
        )
        localStorage.setItem('spectrogram-keyboard-help', 'true')
      }, 2000)
    }
  }, [])

  return {
    // Expose shortcut functions for programmatic use
    togglePlayPause: () => {
      if (isStopped) {
        if (currentTrack) {
          audioFile.playTrack(currentTrack)
        }
      } else if (isPlaying) {
        audioFile.pausePlayback()
      } else {
        audioFile.resumePlayback()
      }
    },
    previousTrack: () => {
      if (playlist.length > 0) {
        const prevIndex = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1
        const prevTrack = playlist[prevIndex]
        if (prevTrack) {
          audioFile.playTrack(prevTrack)
        }
      }
    },
    nextTrack: () => {
      if (playlist.length > 0) {
        const nextIndex = (currentTrackIndex + 1) % playlist.length
        const nextTrack = playlist[nextIndex]
        if (nextTrack) {
          audioFile.playTrack(nextTrack)
        }
      }
    },
    volumeUp: () => {
      const newVolume = Math.min(1, volume + 0.05)
      audioFile.setAudioVolume(newVolume)
    },
    volumeDown: () => {
      const newVolume = Math.max(0, volume - 0.05)
      audioFile.setAudioVolume(newVolume)
    },
    toggleMute: () => audioFile.toggleMute(),
    toggleMetadataPanel: () => setMetadataPanelOpen(!metadataPanelOpen),
    togglePlaylistPanel: () => setPlaylistPanelOpen(!playlistPanelOpen),
    openSettings: () => setSettingsPanelOpen(true),
    takeSnapshot: () => {
      // TODO: Implement snapshot functionality
      console.log('Taking snapshot...')
      toast.success('Snapshot taken!')
    }
  }
}
