
import React, { useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useUIStore } from '../shared/stores/uiStore'
import { useAudioStore } from '../shared/stores/audioStore'
import { useAudioFile } from '../shared/hooks/useAudioFile'
import { useMicrophone } from '../shared/hooks/useMicrophone'
import { useScreenSize } from '../shared/hooks/useScreenSize'
import { useKeyboardShortcuts } from '../shared/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../shared/stores/settingsStore'
import { FileAudio, Mic, MicOff, Settings, Camera, Info, List } from 'lucide-react'
import { cn } from '../shared/utils/cn'
import { SPACING, TYPOGRAPHY, GRID } from '../shared/layout'
import type { Theme } from '../shared/types'
import { useAnimationPreset } from '../shared/animations'
import React, { useRef, useCallback, useMemo } from "react";
import { useUIStore } from "@/shared/stores/uiStore";
import { useAudioStore } from "@/shared/stores/audioStore";
import { useAudioFile } from "@/shared/hooks/useAudioFile";
import { useMicrophone } from "@/shared/hooks/useMicrophone";
import { useScreenSize } from "@/shared/hooks/useScreenSize";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import {
  FileAudio,
  Mic,
  MicOff,
  Settings,
  Camera,
  Info,
  List,
} from "lucide-react";
import { cn } from "../shared/utils/cn";

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    metadataPanelOpen,
    playlistPanelOpen,
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen,
  } = useUIStore();
  const { isMicrophoneActive } = useAudioStore();
  const { isMobile, isTablet } = useScreenSize();
  const audioFile = useAudioFile();
  const microphone = useMicrophone();

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        await audioFile.loadAudioFiles(Array.from(files));
      }
      event.target.value = "";
    },
    [audioFile],
  );

/**
 * Convenience re-exports for the main Header component and its class helper.
 * Allows existing imports from `layout` to resolve while the implementation
 * lives under `components`.
 */
export { Header, getHeaderClasses } from "../components/layout/Header";
export function getHeaderClasses(theme: Theme, isMobile: boolean): string {
  return cn(
    'bg-neutral-900 border-b border-neutral-800',
    'flex items-center justify-between',
    SPACING[theme],
    TYPOGRAPHY[theme],
    GRID[theme],
    'transition-colors duration-300',
    isMobile ? 'h-14' : 'h-12',
  )
}

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { metadataPanelOpen, playlistPanelOpen, setMetadataPanelOpen, setPlaylistPanelOpen, setSettingsPanelOpen } = useUIStore()
  const { isMicrophoneActive } = useAudioStore()
  const { isMobile, isTablet } = useScreenSize()
  const theme = useSettingsStore((s) => s.theme)
  const audioFile = useAudioFile()
  const microphone = useMicrophone()

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await audioFile.loadAudioFiles(Array.from(files))
    }
    event.target.value = ''
  }, [audioFile])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleMicrophone = useCallback(async () => {
    await microphone.toggleMicrophone();
  }, [microphone]);

  const takeSnapshot = useCallback(() => {
    // Placeholder; host can provide callback via props if needed
    console.log("Snapshot not implemented in MFE");
  }, []);

  useKeyboardShortcuts();

  const buttonConfig = useMemo(() => {
    if (isMobile) {
      return {
        showFileButton: true,
        showMicButton: true,
        showSettingsButton: true,
        showMetadataButton: true,
        showPlaylistButton: true,
        showSnapshotButton: false,
        showMenuButton: true,
      };
    } else if (isTablet) {
      return {
        showFileButton: true,
        showMicButton: true,
        showSettingsButton: true,
        showMetadataButton: true,
        showPlaylistButton: true,
        showSnapshotButton: true,
        showMenuButton: false,
      };
    }
    return { showFileButton: true, showMicButton: true, showSettingsButton: true, showMetadataButton: true, showPlaylistButton: true, showSnapshotButton: true, showMenuButton: false }
  }, [isMobile, isTablet])
  const animation = useAnimationPreset('fade')

  return (
    <motion.header {...animation} className={getHeaderClasses(theme, isMobile)} data-testid="app-header">
    return {
      showFileButton: true,
      showMicButton: true,
      showSettingsButton: true,
      showMetadataButton: true,
      showPlaylistButton: true,
      showSnapshotButton: true,
      showMenuButton: false,
    };
  }, [isMobile, isTablet]);

  return (
    <header
      className={cn(
        "bg-neutral-900 border-b border-neutral-800",
        "flex items-center justify-between px-4",
        "transition-colors duration-300",
        isMobile ? "h-14" : "h-12",
      )}
    >
      <div className="flex items-center min-w-0 flex-1">
        <h1
          className={cn(
            "font-semibold text-neutral-100 truncate",
            isMobile ? "text-base" : "text-lg",
          )}
        >
          Spectrogram
        </h1>
      </div>

      {buttonConfig.showMenuButton && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMetadataPanelOpen(!metadataPanelOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Track info (I)"
          >
            <Info size={isMobile ? 20 : 18} />
          </button>
          <button
            onClick={() => setPlaylistPanelOpen(!playlistPanelOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Playlist (P)"
          >
            <List size={isMobile ? 20 : 18} />
          </button>
        </div>
      )}

      <div
        className={cn("flex items-center gap-1", isMobile ? "gap-1" : "gap-2")}
      >
        {buttonConfig.showFileButton && (
          <button
            onClick={openFileDialog}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Open audio file (O)"
          >
            <FileAudio size={isMobile ? 20 : 18} />
          </button>
        )}

        {buttonConfig.showMicButton && (
          <button
            onClick={toggleMicrophone}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
              isMicrophoneActive
                ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700",
            )}
            title="Toggle microphone"
            aria-pressed={isMicrophoneActive}
          >
            {isMicrophoneActive ? (
              <Mic size={isMobile ? 20 : 18} />
            ) : (
              <MicOff size={isMobile ? 20 : 18} />
            )}
          </button>
        )}

        {buttonConfig.showSettingsButton && (
          <button
            onClick={() => setSettingsPanelOpen(true)}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Settings (S)"
          >
            <Settings size={isMobile ? 20 : 18} />
          </button>
        )}

        {buttonConfig.showSnapshotButton && (
          <button
            onClick={takeSnapshot}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Take snapshot (Ctrl+Shift+S)"
          >
            <Camera size={isMobile ? 20 : 18} />
          </button>
        )}

        {!isMobile && buttonConfig.showMetadataButton && (
          <button
            onClick={() => setMetadataPanelOpen(!metadataPanelOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              metadataPanelOpen
                ? "text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                : "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Toggle metadata panel (I)"
          >
            <Info size={18} />
          </button>
        )}

        {!isMobile && buttonConfig.showPlaylistButton && (
          <button
            onClick={() => setPlaylistPanelOpen(!playlistPanelOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              playlistPanelOpen
                ? "text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20"
                : "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Toggle playlist panel (P)"
          >
            <List size={18} />
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" multiple onChange={handleFileSelect} className="hidden" />
    </motion.header>
  )
}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </header>
  );
};
