import { useEffect, useMemo } from 'react'
import { Toaster } from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SpectrogramView } from '@/components/spectrogram/SpectrogramView'
import { MetadataPanel } from '@/components/layout/MetadataPanel'
import { PlaylistPanel } from '@/components/layout/PlaylistPanel'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { ShortcutsModal } from '@/components/layout/ShortcutsModal'
import { useAudioStore } from '@/stores/audioStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useScreenSize } from '@/hooks/useScreenSize'
import { initWASM } from '@/utils/wasm'
import { audioPlayer } from '@/utils/audioPlayer'
import { cn } from '@/utils/cn'

function App() {
  const settingsStore = useSettingsStore()
  const { theme, updateSettings, loadFromStorage } = settingsStore
  const {
    isMobile,
    isTablet,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen,
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen,
    shortcutsHelpOpen,
    setShortcutsHelpOpen
  } = useUIStore()
  const { currentTrack, playlist, currentTrackIndex, playTrack, removeFromPlaylist, reorderPlaylist } = useAudioStore()
  
  // Initialize hooks
  useKeyboardShortcuts()
  useScreenSize()

  // Load settings from storage on app start
  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  // Apply theme to body without clobbering existing classes
  useEffect(() => {
    const className = `theme-${theme}`
    const bodyClassList = document.body.classList

    // Remove any existing theme classes before applying the new one
    bodyClassList.remove('theme-dark', 'theme-light')
    bodyClassList.add(className)

    // Set theme color for mobile browser UI
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? '#0a0a0a' : '#ffffff'
      )
    }

    return () => {
      bodyClassList.remove(className)
    }
  }, [theme])

  // Initialize WASM module
  useEffect(() => {
    initWASM().catch(error => {
      // Silently handle WASM initialization error
    })
  }, [])

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      audioPlayer.cleanup()
    }
  }, [])

  // Determine layout based on screen size and panel states
  const layoutConfig = useMemo(() => {
    if (isMobile) {
      return {
        showSidebars: false,
        spectrogramFullWidth: true,
        headerHeight: 'h-14',
        footerHeight: 'h-20'
      }
    } else if (isTablet) {
      return {
        showSidebars: metadataPanelOpen || playlistPanelOpen,
        spectrogramFullWidth: !metadataPanelOpen && !playlistPanelOpen,
        headerHeight: 'h-12',
        footerHeight: 'h-16'
      }
    } else {
      return {
        showSidebars: true,
        spectrogramFullWidth: false,
        headerHeight: 'h-12',
        footerHeight: 'h-16'
      }
    }
  }, [isMobile, isTablet, metadataPanelOpen, playlistPanelOpen])

  return (
    <div 
      className={cn(
        'app-layout bg-neutral-950 text-neutral-100',
        'transition-colors duration-300',
        'min-h-screen'
      )} 
      data-testid="app-container"
      role="application"
      aria-label="Audio Spectrogram Application"
    >
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className={cn(
        'main-content flex-1 flex relative overflow-hidden',
        layoutConfig.spectrogramFullWidth ? 'w-full' : ''
      )}>
        {/* Left Sidebar - Metadata */}
        {!isMobile && (
          <div className={cn(
            'sidebar-left transition-all duration-300 ease-in-out',
            metadataPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden',
            isTablet ? 'absolute left-0 top-0 h-full z-20 shadow-2xl' : 'relative'
          )}>
            <MetadataPanel 
              track={currentTrack}
              isOpen={metadataPanelOpen}
              onClose={() => setMetadataPanelOpen(false)}
            />
          </div>
        )}
        
        {/* Center - Content Area */}
        <div className={cn(
          'content-area flex-1 flex flex-col relative overflow-hidden',
          'transition-all duration-300 ease-in-out'
        )}>
          <SpectrogramView />
          
          {/* Footer Controls */}
          <Footer />
        </div>
        
        {/* Right Sidebar - Playlist */}
        {!isMobile && (
          <div className={cn(
            'sidebar-right transition-all duration-300 ease-in-out',
            playlistPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden',
            isTablet ? 'absolute right-0 top-0 h-full z-20 shadow-2xl' : 'relative'
          )}>
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
      
      {/* Mobile Overlay Panels */}
      {isMobile && (
        <>
          {/* Metadata Panel Overlay */}
          {metadataPanelOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
              <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden">
                <MetadataPanel 
                  track={currentTrack}
                  isOpen={metadataPanelOpen}
                  onClose={() => setMetadataPanelOpen(false)}
                />
              </div>
            </div>
          )}
          
          {/* Playlist Panel Overlay */}
          {playlistPanelOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
              <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden">
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
            </div>
          )}
        </>
      )}

      {/* Settings Panel (Modal) */}
      <SettingsPanel
        settings={settingsStore}
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onSettingsChange={updateSettings}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
      
      {/* Toast Notifications */}
      <Toaster
        position={isMobile ? "top-center" : "top-right"}
        toastOptions={{
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
            color: theme === 'dark' ? '#ffffff' : '#000000',
            border: theme === 'dark' ? '1px solid #333333' : '1px solid #e5e5e5',
            borderRadius: '12px',
            fontSize: '14px',
            maxWidth: isMobile ? '90vw' : '400px',
          },
          success: {
            iconTheme: {
              primary: '#4CAF50',
              secondary: theme === 'dark' ? '#ffffff' : '#000000',
            },
          },
          error: {
            iconTheme: {
              primary: '#f44336',
              secondary: theme === 'dark' ? '#ffffff' : '#000000',
            },
          },
        }}
      />
    </div>
  )
}

export default App
