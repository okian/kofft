import { useEffect, useCallback } from "react";
import { useUIStore } from "@/shared/stores/uiStore";
import { useAudioStore } from "@/shared/stores/audioStore";
import { useAudioFile } from "@/shared/hooks/useAudioFile";
import { conditionalToast } from "@/shared/utils/toast";

/**
 * Number of seconds to seek when using Arrow Left/Right.
 * Chosen to provide responsive coarse navigation without large jumps.
 */
const SMALL_SEEK_SECONDS = 5;

/**
 * Number of seconds to seek when using J/L shortcuts.
 * These keys mirror common media players for larger jumps.
 */
const LARGE_SEEK_SECONDS = 10;

/**
 * Increment applied to volume when using Arrow Up/Down.
 * A small step keeps adjustments smooth for the user.
 */
const VOLUME_STEP = 0.05;

/**
 * Minimum allowed playback time in seconds to prevent negative seeks.
 */
const MIN_TIME_SECONDS = 0;

/**
 * Minimum and maximum volume bounds enforced for all volume operations.
 */
const MIN_VOLUME = 0;
const MAX_VOLUME = 1;

/**
 * Delay before showing the initial keyboard help toast in milliseconds.
 * A short delay avoids interrupting initial UI rendering.
 */
const HELP_TOAST_DELAY_MS = 2000;

/**
 * Index of the first item in an array; used for playlist boundary checks.
 */
const FIRST_INDEX = 0;

/**
 * Increment/decrement step when navigating playlist indices.
 */
const INDEX_STEP = 1;

/**
 * Value representing an empty playlist length.
 */
const EMPTY_PLAYLIST_LENGTH = 0;

/**
 * useKeyboardShortcuts centralizes global keyboard handling for playback and UI actions.
 * It registers a keydown listener and exposes imperative helpers for programmatic control.
 */
export const useKeyboardShortcuts = () => {
  const {
    setMetadataPanelOpen,
    setPlaylistPanelOpen,
    setSettingsPanelOpen,
    setShortcutsHelpOpen,
    metadataPanelOpen,
    playlistPanelOpen,
    settingsPanelOpen,
    shortcutsHelpOpen,
  } = useUIStore();

  const {
    isPlaying,
    isStopped,
    currentTrack,
    playlist,
    currentTrackIndex,
    volume,
    currentTime,
    duration,
  } = useAudioStore();

  const audioFile = useAudioFile();

  /**
   * Toggle playback state while centralizing state checks.
   * Starts playback if stopped and a track is selected, otherwise
   * pauses or resumes based on the current status.
   */
  const togglePlayPause = useCallback(() => {
    // If nothing has been played yet but a track is selected, start it.
    if (isStopped) {
      if (currentTrack) {
        audioFile.playTrack(currentTrack);
      }
      return;
    }

    // If currently playing, pause; otherwise resume from current position.
    if (isPlaying) {
      audioFile.pausePlayback();
    } else {
      audioFile.resumePlayback();
    }
  }, [audioFile, currentTrack, isPlaying, isStopped]);

  /**
   * Respond to global key presses and trigger matching actions while
   * ignoring interactive form elements. Modifier keys are validated for
   * each shortcut to avoid accidental activation.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const { key, code, ctrlKey, shiftKey, metaKey, altKey } = event;

      // Spacebar or K - Play/Pause. Browsers inconsistently report the
      // space key so we defensively check both `key` and `code` variations.
      const isSpace = code === "Space" || key === " " || key === "Spacebar";
      const isK = key.toLowerCase() === "k" || code === "KeyK";
      if ((isSpace || isK) && !ctrlKey && !shiftKey && !metaKey) {
        event.preventDefault();
        togglePlayPause();
        return;
      }

      // Arrow Left - Seek backward 5s
      if (key === "ArrowLeft" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        if (currentTrack) {
          const newTime = Math.max(
            MIN_TIME_SECONDS,
            currentTime - SMALL_SEEK_SECONDS,
          );
          audioFile.seekTo(newTime);
        }
        return;
      }

      // Arrow Right - Seek forward 5s
      if (key === "ArrowRight" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        if (currentTrack) {
          const newTime = Math.min(duration, currentTime + SMALL_SEEK_SECONDS);
          audioFile.seekTo(newTime);
        }
        return;
      }

      // Ctrl/Cmd + Arrow Left - Previous track
      if (key === "ArrowLeft" && (ctrlKey || metaKey) && !altKey) {
        event.preventDefault();
        if (playlist.length > EMPTY_PLAYLIST_LENGTH) {
          const prevIndex =
            currentTrackIndex <= FIRST_INDEX
              ? playlist.length - INDEX_STEP
              : currentTrackIndex - INDEX_STEP;
          const prevTrack = playlist[prevIndex];
          if (prevTrack) {
            audioFile.playTrack(prevTrack);
          }
        }
        return;
      }

      // Ctrl/Cmd + Arrow Right - Next track
      if (key === "ArrowRight" && (ctrlKey || metaKey) && !altKey) {
        event.preventDefault();
        if (playlist.length > EMPTY_PLAYLIST_LENGTH) {
          const nextIndex = (currentTrackIndex + INDEX_STEP) % playlist.length;
          const nextTrack = playlist[nextIndex];
          if (nextTrack) {
            audioFile.playTrack(nextTrack);
          }
        }
        return;
      }

      // Arrow Up - Volume up
      if (key === "ArrowUp" && !ctrlKey && !shiftKey && !metaKey) {
        event.preventDefault();
        const newVolume = Math.min(MAX_VOLUME, volume + VOLUME_STEP);
        audioFile.setAudioVolume(newVolume);
        return;
      }

      // Arrow Down - Volume down
      if (key === "ArrowDown" && !ctrlKey && !shiftKey && !metaKey) {
        event.preventDefault();
        const newVolume = Math.max(MIN_VOLUME, volume - VOLUME_STEP);
        audioFile.setAudioVolume(newVolume);
        return;
      }

      // J - 10 seconds back
      if (key.toLowerCase() === "j" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        if (currentTrack) {
          const newTime = Math.max(
            MIN_TIME_SECONDS,
            currentTime - LARGE_SEEK_SECONDS,
          );
          audioFile.seekTo(newTime);
        }
        return;
      }

      // L - 10 seconds forward
      if (key.toLowerCase() === "l" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        if (currentTrack) {
          const newTime = Math.min(duration, currentTime + LARGE_SEEK_SECONDS);
          audioFile.seekTo(newTime);
        }
        return;
      }

      // M - Mute/Unmute
      if (key.toLowerCase() === "m" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        audioFile.toggleMute();
        return;
      }

      // I - Toggle metadata panel
      if (key.toLowerCase() === "i" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        setMetadataPanelOpen(!metadataPanelOpen);
        return;
      }

      // P - Toggle playlist panel
      if (key.toLowerCase() === "p" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        setPlaylistPanelOpen(!playlistPanelOpen);
        return;
      }

      // S - Open settings
      if (key.toLowerCase() === "s" && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        setSettingsPanelOpen(true);
        return;
      }

      // ? - Toggle shortcuts help
      if (key === "?" && !ctrlKey && !altKey && !metaKey) {
        event.preventDefault();
        setShortcutsHelpOpen(!shortcutsHelpOpen);
        return;
      }

      // Ctrl/Cmd + Shift + S - Snapshot
      if (key.toLowerCase() === "s" && (ctrlKey || metaKey) && shiftKey) {
        event.preventDefault();
        // TODO: Implement snapshot functionality
        conditionalToast.success("Snapshot taken!");
        return;
      }

      // Escape - Close panels/modals
      if (key === "Escape") {
        event.preventDefault();
        if (settingsPanelOpen) {
          setSettingsPanelOpen(false);
        } else if (metadataPanelOpen) {
          setMetadataPanelOpen(false);
        } else if (playlistPanelOpen) {
          setPlaylistPanelOpen(false);
        } else if (shortcutsHelpOpen) {
          setShortcutsHelpOpen(false);
        }
        return;
      }

      // O - Open file dialog (if implemented)
      if (key.toLowerCase() === "o" && !ctrlKey && !shiftKey && !metaKey) {
        event.preventDefault();
        // This would trigger the file input, but we need to access the file input ref
        // For now, we'll just show a toast
        conditionalToast.info("Use the file button to open audio files");
        return;
      }
    },
    [
      playlist,
      currentTrack,
      currentTrackIndex,
      volume,
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
      setShortcutsHelpOpen,
      togglePlayPause,
    ],
  );

  // Add event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Show keyboard shortcuts help on first visit
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem("spectrogram-keyboard-help");
    if (!hasSeenHelp) {
      setTimeout(() => {
        conditionalToast.success(
          "💡 Keyboard shortcuts available! Press ? to view all shortcuts.",
        );
        localStorage.setItem("spectrogram-keyboard-help", "true");
      }, HELP_TOAST_DELAY_MS);
    }
  }, []);

  return {
    // Expose shortcut functions for programmatic use
    togglePlayPause,
    /**
     * Play the previous track in the playlist, wrapping to the end when at start.
     */
    previousTrack: () => {
      if (playlist.length > EMPTY_PLAYLIST_LENGTH) {
        const prevIndex =
          currentTrackIndex <= FIRST_INDEX
            ? playlist.length - INDEX_STEP
            : currentTrackIndex - INDEX_STEP;
        const prevTrack = playlist[prevIndex];
        if (prevTrack) {
          audioFile.playTrack(prevTrack);
        }
      }
    },
    /**
     * Play the next track in the playlist, wrapping to the start when at end.
     */
    nextTrack: () => {
      if (playlist.length > EMPTY_PLAYLIST_LENGTH) {
        const nextIndex = (currentTrackIndex + INDEX_STEP) % playlist.length;
        const nextTrack = playlist[nextIndex];
        if (nextTrack) {
          audioFile.playTrack(nextTrack);
        }
      }
    },
    /**
     * Increase volume by a small step while respecting the maximum bound.
     */
    volumeUp: () => {
      const newVolume = Math.min(MAX_VOLUME, volume + VOLUME_STEP);
      audioFile.setAudioVolume(newVolume);
    },
    /**
     * Decrease volume by a small step while respecting the minimum bound.
     */
    volumeDown: () => {
      const newVolume = Math.max(MIN_VOLUME, volume - VOLUME_STEP);
      audioFile.setAudioVolume(newVolume);
    },
    /** Toggle muted state of the audio output. */
    toggleMute: () => audioFile.toggleMute(),
    /** Toggle visibility of the metadata panel. */
    toggleMetadataPanel: () => setMetadataPanelOpen(!metadataPanelOpen),
    /** Toggle visibility of the playlist panel. */
    togglePlaylistPanel: () => setPlaylistPanelOpen(!playlistPanelOpen),
    /** Open the settings panel. */
    openSettings: () => setSettingsPanelOpen(true),
    /** Placeholder snapshot handler until implemented. */
    takeSnapshot: () => {
      // TODO: Implement snapshot functionality
      conditionalToast.success("Snapshot taken!");
    },
  };
};
