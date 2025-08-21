import React, { useRef, useCallback, useMemo } from "react";
import { useUIStore } from "../shared/stores/uiStore";
import { useAudioStore } from "../shared/stores/audioStore";
import { useAudioFile } from "../shared/hooks/useAudioFile";
import { useMicrophone } from "../shared/hooks/useMicrophone";
import { useScreenSize } from "../shared/hooks/useScreenSize";
import { useKeyboardShortcuts } from "../shared/hooks/useKeyboardShortcuts";
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
import { useSpectrogramStore } from "../shared/stores/spectrogramStore";
import {
  takeSnapshot as captureSnapshot,
  DEFAULT_SNAPSHOT_FILENAME,
  SNAPSHOT_SUCCESS_MESSAGE,
  SNAPSHOT_ERROR_MESSAGE,
} from "../shared/utils/takeSnapshot";
import { conditionalToast } from "../shared/utils/toast";

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

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleMicrophone = useCallback(async () => {
    await microphone.toggleMicrophone();
  }, [microphone]);

  const handleSnapshot = useCallback(() => {
    try {
      const canvas = useSpectrogramStore.getState().canvasRef?.getCanvas();
      captureSnapshot({ canvas, fileName: DEFAULT_SNAPSHOT_FILENAME });
      conditionalToast.success(SNAPSHOT_SUCCESS_MESSAGE);
    } catch (error) {
      conditionalToast.error(SNAPSHOT_ERROR_MESSAGE);
    }
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
            onClick={handleSnapshot}
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
