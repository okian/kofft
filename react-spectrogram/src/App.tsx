import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SpectrogramView } from '@/components/spectrogram/SpectrogramView'
import { MetadataPanel } from '@/components/layout/MetadataPanel'
import { PlaylistPanel } from '@/components/layout/PlaylistPanel'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { useAudioStore } from '@/stores/audioStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useScreenSize } from '@/hooks/useScreenSize'
import { initWASM } from '@/utils/wasm'
import { cn } from '@/utils/cn'

function App() {
  const settingsStore = useSettingsStore()
  const { theme, updateSettings } = settingsStore
  const { isMobile, metadataPanelOpen, playlistPanelOpen, settingsPanelOpen, setMetadataPanelOpen, setPlaylistPanelOpen, setSettingsPanelOpen } = useUIStore()
  const { currentTrack, playlist, currentTrackIndex, playTrack, removeFromPlaylist, reorderPlaylist } = useAudioStore()
  
  // Initialize hooks
  useKeyboardShortcuts()
  useScreenSize()

  // Apply theme to body
  useEffect(() => {
    document.body.className = `theme-${theme}`
  }, [theme])

  // Initialize WASM module
  useEffect(() => {
    initWASM().catch(error => {
      console.warn('Failed to initialize WASM module:', error)
    })
  }, [])

  return (
    <div className={cn(
      'app-layout bg-neutral-950 text-neutral-100',
      'transition-colors duration-300'
    )} data-testid="app-container">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className="main-content">
        {/* Left Sidebar - Metadata */}
        {!isMobile && metadataPanelOpen && (
          <div className="sidebar-left">
            <MetadataPanel 
              track={currentTrack}
              isOpen={metadataPanelOpen}
              onClose={() => setMetadataPanelOpen(false)}
            />
          </div>
        )}
        
        {/* Center - Content Area */}
        <div className="content-area">
          <SpectrogramView />
          
          {/* Footer Controls */}
          <Footer />
        </div>
        
        {/* Right Sidebar - Playlist */}
        {!isMobile && playlistPanelOpen && (
          <div className="sidebar-right">
            <PlaylistPanel 
              tracks={playlist}
              currentTrackIndex={currentTrackIndex}
              isOpen={playlistPanelOpen}
              onClose={() => setPlaylistPanelOpen(false)}
              onTrackSelect={(index) => playTrack(index)}
              onTrackRemove={(index) => removeFromPlaylist(index)}
              onTrackReorder={(from, to) => reorderPlaylist(from, to)}
            />
          </div>
        )}
      </div>
      
      {/* Settings Panel (Modal) */}
      <SettingsPanel 
        settings={settingsStore}
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onSettingsChange={updateSettings}
      />
      
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#ffffff',
            border: '1px solid #333333',
          },
          success: {
            iconTheme: {
              primary: '#4CAF50',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#f44336',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </div>
  )
}

export default App
