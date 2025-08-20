import React, { useEffect } from 'react'
import { Header } from '../layout/Header'
import { Footer } from '../layout/Footer'
import { SpectrogramView } from '../features/spectrogram/SpectrogramView'
import { MetadataPanel } from '../features/metadata/MetadataPanel'
import { PlaylistPanel } from '../features/playlist/PlaylistPanel'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import { ShortcutsModal } from '../features/shortcuts/ShortcutsModal'
import { useUIStore } from '../shared/stores/uiStore'
import { useSettingsStore } from '../shared/stores/settingsStore'
import { useAudioStore } from '../shared/stores/audioStore'
import { Toaster } from 'react-hot-toast'

export function App() {
  const { theme, updateSettings, loadFromStorage } = useSettingsStore()
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
    setShortcutsHelpOpen,
  } = useUIStore()

  const {
    currentTrack,
    playlist,
    currentTrackIndex,
    playTrack,
    removeFromPlaylist,
    reorderPlaylist,
  } = useAudioStore()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  useEffect(() => {
    const className = `theme-${theme}`
    const bodyClassList = document.body.classList
    bodyClassList.remove('theme-dark', 'theme-light')
    bodyClassList.add(className)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff')
    }
    return () => {
      bodyClassList.remove(className)
    }
  }, [theme])

  return (
    <div className="app-layout bg-neutral-950 text-neutral-100 min-h-screen">
      <Header />
      <div className="main-content flex-1 flex relative overflow-hidden">
        {!isMobile && (
          <div className={`sidebar-left ${metadataPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'} ${isTablet ? 'absolute left-0 top-0 h-full z-20 shadow-2xl' : 'relative'}`}>
            <MetadataPanel
              track={currentTrack}
              isOpen={metadataPanelOpen}
              onClose={() => setMetadataPanelOpen(false)}
            />
          </div>
        )}

        <div className="content-area flex-1 flex flex-col relative overflow-hidden">
          <SpectrogramView />
          <Footer />
        </div>

        {!isMobile && (
          <div className={`sidebar-right ${playlistPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'} ${isTablet ? 'absolute right-0 top-0 h-full z-20 shadow-2xl' : 'relative'}`}>
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

      {isMobile && (
        <>
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
          {playlistPanelOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
              <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl shadow-2xl max-h=[80vh] overflow-hidden">
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

      <SettingsPanel
        settings={useSettingsStore.getState()}
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onSettingsChange={updateSettings}
      />

      <ShortcutsModal isOpen={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

      <Toaster position={isMobile ? 'top-center' : 'top-right'} />
    </div>
  )
}


