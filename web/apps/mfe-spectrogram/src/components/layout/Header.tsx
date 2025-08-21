import React, { useRef, useCallback, useMemo } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useAudioStore } from "@/stores/audioStore";
import { useAudioFile } from "@/hooks/useAudioFile";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useScreenSize } from "@/hooks/useScreenSize";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  FileAudio,
  Mic,
  MicOff,
  Settings,
  Camera,
  Info,
  List,
  Menu,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useSpectrogramStore } from "@/shared/stores/spectrogramStore";
import {
  takeSnapshot as captureSnapshot,
  DEFAULT_SNAPSHOT_FILENAME,
  SNAPSHOT_SUCCESS_MESSAGE,
  SNAPSHOT_ERROR_MESSAGE,
} from "@/utils/takeSnapshot";
import { conditionalToast } from "@/utils/toast";

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

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        try {
          await audioFile.loadAudioFiles(Array.from(files));
        } catch (error) {
          console.error("Failed to load files:", error);
        }
      }
      // Reset input value to allow selecting the same file again
      event.target.value = "";
    },
    [audioFile],
  );

  // Open file dialog
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    await microphone.toggleMicrophone();
  }, [microphone]);

  // Capture the spectrogram canvas and download it. Errors are reported via
  // toast notifications so the user knows if the operation failed.
  const handleSnapshot = useCallback(() => {
    try {
      const canvas = useSpectrogramStore.getState().canvasRef?.getCanvas();
      captureSnapshot({ canvas, fileName: DEFAULT_SNAPSHOT_FILENAME });
      conditionalToast.success(SNAPSHOT_SUCCESS_MESSAGE);
    } catch (error) {
      conditionalToast.error(SNAPSHOT_ERROR_MESSAGE);
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Determine which buttons to show based on screen size
  const buttonConfig = useMemo(() => {
    if (isMobile) {
      return {
        showFileButton: true,
        showMicButton: true,
        showSettingsButton: true,
        showMetadataButton: true,
        showPlaylistButton: true,
        showSnapshotButton: false, // Hide on mobile to save space
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
    } else {
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
  }, [isMobile, isTablet]);

  return (
    <header
      className={cn(
        "bg-neutral-900 border-b border-neutral-800",
        "flex items-center justify-between px-4",
        "transition-colors duration-300",
        isMobile ? "h-14" : "h-12",
      )}
      data-testid="header"
      role="banner"
      aria-label="Application header"
    >
      {/* Left side - App title */}
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

      {/* Center - Mobile menu button (only on mobile) */}
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
            data-testid="mobile-info-button"
            aria-label="Show track information"
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
            data-testid="mobile-playlist-button"
            aria-label="Show playlist"
          >
            <List size={isMobile ? 20 : 18} />
          </button>
        </div>
      )}

      {/* Right side - Controls */}
      <div
        className={cn("flex items-center gap-1", isMobile ? "gap-1" : "gap-2")}
      >
        {/* File input button */}
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
            data-testid="open-file-button"
            aria-label="Open audio file"
          >
            <FileAudio size={isMobile ? 20 : 18} />
          </button>
        )}

        {/* Microphone toggle button */}
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
            data-testid="microphone-button"
            aria-label={
              isMicrophoneActive ? "Disable microphone" : "Enable microphone"
            }
            aria-pressed={isMicrophoneActive}
          >
            {isMicrophoneActive ? (
              <Mic size={isMobile ? 20 : 18} />
            ) : (
              <MicOff size={isMobile ? 20 : 18} />
            )}
          </button>
        )}

        {/* Settings button */}
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
            data-testid="settings-button"
            aria-label="Open settings"
          >
            <Settings size={isMobile ? 20 : 18} />
          </button>
        )}

        {/* Snapshot button */}
        {buttonConfig.showSnapshotButton && (
          <button
            onClick={handleSnapshot}
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
            )}
            title="Take snapshot (Ctrl+Shift+S)"
            data-testid="snapshot-button"
            aria-label="Take spectrogram snapshot"
          >
            <Camera size={isMobile ? 20 : 18} />
          </button>
        )}

        {/* Metadata panel toggle (desktop/tablet only) */}
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
            data-testid="metadata-panel-button"
            aria-label="Toggle metadata panel"
            aria-pressed={metadataPanelOpen}
          >
            <Info size={18} />
          </button>
        )}

        {/* Playlist panel toggle (desktop/tablet only) */}
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
            data-testid="playlist-panel-button"
            aria-label="Toggle playlist panel"
            aria-pressed={playlistPanelOpen}
          >
            <List size={18} />
          </button>
        )}
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
        aria-label="Select audio files"
      />
    </header>
  );
};
