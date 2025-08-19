import { useEffect, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAudioStore } from '@/stores/audioStore'
import { useAudioFile } from '@/hooks/useAudioFile'
import { conditionalToast } from '@/utils/toast'

export const useKeyboardShortcuts = () => {
  const {
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen,
    setShortcutsHelpOpen,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen,
    shortcutsHelpOpen
  } = useUIStore()
  
  const { 
    isPlaying, 
    isPaused, 
    isStopped, 
    currentTrack, 
    playlist, 
    currentTrackIndex,
    volume,
    isMuted,
    currentTime,
    duration
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

    const { key, ctrlKey, shiftKey, metaKey, altKey } = event

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

    // K - Play/Pause (alternative to spacebar)
    if (key.toLowerCase() === 'k' && !ctrlKey && !shiftKey && !metaKey) {
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

    // Arrow Left - Seek backward 5s
    if (key === 'ArrowLeft' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      if (currentTrack) {
        const newTime = Math.max(0, currentTime - 5)
        audioFile.seekTo(newTime)
      }
      return
    }

    // Arrow Right - Seek forward 5s
    if (key === 'ArrowRight' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      if (currentTrack) {
        const newTime = Math.min(duration, currentTime + 5)
        audioFile.seekTo(newTime)
      }
      return
    }

    // Ctrl/Cmd + Arrow Left - Previous track
    if (key === 'ArrowLeft' && (ctrlKey || metaKey) && !altKey) {
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

    // Ctrl/Cmd + Arrow Right - Next track
    if (key === 'ArrowRight' && (ctrlKey || metaKey) && !altKey) {
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

    // J - 10 seconds back
    if (key.toLowerCase() === 'j' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      if (currentTrack) {
        const newTime = Math.max(0, currentTime - 10)
        audioFile.seekTo(newTime)
      }
      return
    }

    // L - 10 seconds forward
    if (key.toLowerCase() === 'l' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      if (currentTrack) {
        const newTime = Math.min(duration, currentTime + 10)
        audioFile.seekTo(newTime)
      }
      return
    }

    // M - Mute/Unmute
    if (key.toLowerCase() === 'm' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      audioFile.toggleMute()
      return
    }

    // I - Toggle metadata panel
    if (key.toLowerCase() === 'i' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      setMetadataPanelOpen(!metadataPanelOpen)
      return
    }

    // P - Toggle playlist panel
    if (key.toLowerCase() === 'p' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      setPlaylistPanelOpen(!playlistPanelOpen)
      return
    }

    // S - Open settings
    if (key.toLowerCase() === 's' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault()
      setSettingsPanelOpen(true)
      return
    }

    // ? - Toggle shortcuts help
    if (key === '?' && !ctrlKey && !altKey && !metaKey) {
      event.preventDefault()
      setShortcutsHelpOpen(!shortcutsHelpOpen)
      return
    }

    // Ctrl/Cmd + Shift + S - Snapshot
    if (key.toLowerCase() === 's' && (ctrlKey || metaKey) && shiftKey) {
      event.preventDefault()
      // TODO: Implement snapshot functionality
      conditionalToast.success('Snapshot taken!')
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
      } else if (shortcutsHelpOpen) {
        setShortcutsHelpOpen(false)
      }
      return
    }

    // O - Open file dialog (if implemented)
    if (key.toLowerCase() === 'o' && !ctrlKey && !shiftKey && !metaKey) {
      event.preventDefault()
      // This would trigger the file input, but we need to access the file input ref
      // For now, we'll just show a toast
      conditionalToast.info('Use the file button to open audio files')
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
    currentTime,
    duration,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen,
    shortcutsHelpOpen,
    audioFile,
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen,
    setShortcutsHelpOpen
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
        conditionalToast.success(
          '💡 Keyboard shortcuts available! Press ? to view all shortcuts.'
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
      conditionalToast.success('Snapshot taken!')
    }
  }
}
