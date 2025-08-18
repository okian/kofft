import React, { useRef, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAudioStore } from '@/stores/audioStore'
import { useAudioFile } from '@/hooks/useAudioFile'
import { useMicrophone } from '@/hooks/useMicrophone'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { 
  FileAudio, 
  Mic, 
  MicOff, 
  Settings, 
  Camera,
  Info,
  List
} from 'lucide-react'
import { cn } from '@/utils/cn'

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { metadataPanelOpen, playlistPanelOpen, setMetadataPanelOpen, setPlaylistPanelOpen, setSettingsPanelOpen } = useUIStore()
  const { isMicrophoneActive } = useAudioStore()
  
  const audioFile = useAudioFile()
  const microphone = useMicrophone()

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      try {
        await audioFile.loadAudioFiles(Array.from(files))
      } catch (error) {
        console.error('Failed to load files:', error)
      }
    }
    // Reset input value to allow selecting the same file again
    event.target.value = ''
  }, [audioFile])

  // Open file dialog
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    await microphone.toggleMicrophone()
  }, [microphone])

  // Take snapshot
  const takeSnapshot = useCallback(() => {
    // TODO: Implement snapshot functionality
    console.log('Taking snapshot...')
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <header 
      className={cn(
        'h-12 bg-neutral-900 border-b border-neutral-800',
        'flex items-center justify-between px-4',
        'transition-colors duration-300'
      )}
      data-testid="header"
    >
      {/* Left side - App title */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-neutral-100">
          Spectrogram
        </h1>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-2">
        {/* File input button */}
        <button
          onClick={openFileDialog}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            'text-neutral-400 hover:text-neutral-200'
          )}
          title="Open audio file (O)"
          data-testid="open-file-button"
        >
          <FileAudio size={20} />
        </button>

        {/* Microphone toggle button */}
        <button
          onClick={toggleMicrophone}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            isMicrophoneActive 
              ? 'text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20' 
              : 'text-neutral-400 hover:text-neutral-200'
          )}
          title="Toggle microphone (M)"
          data-testid="microphone-button"
        >
          {isMicrophoneActive ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Settings button */}
        <button
          onClick={() => setSettingsPanelOpen(true)}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            'text-neutral-400 hover:text-neutral-200'
          )}
          title="Settings (S)"
          data-testid="settings-button"
        >
          <Settings size={20} />
        </button>

        {/* Snapshot button */}
        <button
          onClick={takeSnapshot}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            'text-neutral-400 hover:text-neutral-200'
          )}
          title="Take snapshot (Ctrl+Shift+S)"
          data-testid="snapshot-button"
        >
          <Camera size={20} />
        </button>

        {/* Metadata panel toggle */}
        <button
          onClick={() => setMetadataPanelOpen(!metadataPanelOpen)}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            metadataPanelOpen 
              ? 'text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20' 
              : 'text-neutral-400 hover:text-neutral-200'
          )}
          title="Toggle metadata panel (M)"
          data-testid="metadata-panel-button"
        >
          <Info size={20} />
        </button>

        {/* Playlist panel toggle */}
        <button
          onClick={() => setPlaylistPanelOpen(!playlistPanelOpen)}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            'hover:bg-neutral-800 active:bg-neutral-700',
            playlistPanelOpen 
              ? 'text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20' 
              : 'text-neutral-400 hover:text-neutral-200'
          )}
          title="Toggle playlist panel (P)"
          data-testid="playlist-panel-button"
        >
          <List size={20} />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
      />
    </header>
  )
}
