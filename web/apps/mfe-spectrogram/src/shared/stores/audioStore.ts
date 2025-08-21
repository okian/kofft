import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { AudioState, AudioTrack, LoopMode } from "@/shared/types";
import { playbackEngine } from "@/shared/utils/PlaybackEngine";
// The playback engine registers callbacks with the store upon import.
// We reference it to satisfy TypeScript/ESLint that the import is
// intentional even though we don't call methods directly here.
void playbackEngine;
import { audioPlayer } from "@/shared/utils/audioPlayer";
import { revokeTrackUrl } from "@/shared/utils/audio";

// Persistent storage key. Using a constant avoids magic strings and
// keeps the key consistent across the application and tests.
export const AUDIO_PERSISTENCE_KEY = "audio-preferences";

// Minimum legal playback position in seconds. Using a constant makes
// the domain assumptions explicit and avoids scattering magic numbers.
const MIN_AUDIO_TIME = 0;

// Volume bounds expressed explicitly to avoid magic numbers and to make
// intent clear wherever volume values are clamped.
const MIN_VOLUME = 0;
const MAX_VOLUME = 1;

// Sentinel value used for indexes when no valid track is selected. Keeping
// this in one place avoids sprinkling `-1` throughout the codebase.
const NO_TRACK_INDEX = -1;

// Initial value for the shuffle history pointer indicating an empty history.
const NO_HISTORY_INDEX = -1;

// Allowed loop mode values for runtime validation. A plain object is
// cheaper than an array+includes and provides O(1) lookups.
const VALID_LOOP_MODES: Record<LoopMode, true> = {
  off: true,
  one: true,
  all: true,
};

/**
 * Safely load persisted playback preferences from localStorage.
 * Any failure results in safe defaults. This function is intentionally
 * defensive because localStorage is mutable and may contain garbage.
 */
const loadPersistedPreferences = (): Pick<
  AudioState,
  "shuffle" | "loopMode"
> => {
  try {
    const raw = localStorage.getItem(AUDIO_PERSISTENCE_KEY);
    if (!raw) return { shuffle: false, loopMode: "off" };
    const parsed = JSON.parse(raw) as Partial<AudioState>;
    const shuffle =
      typeof parsed.shuffle === "boolean" ? parsed.shuffle : false;
    const loopMode =
      typeof parsed.loopMode === "string" && parsed.loopMode in VALID_LOOP_MODES
        ? (parsed.loopMode as LoopMode)
        : "off";
    return { shuffle, loopMode };
  } catch {
    // localStorage access can fail (e.g., security settings or invalid JSON)
    // In such cases we revert to known-safe defaults.
    return { shuffle: false, loopMode: "off" };
  }
};

/**
 * Persist playback preferences. Persistence failures are intentionally
 * swallowed: missing storage should not crash the application.
 */
const persistPreferences = (
  prefs: Pick<AudioState, "shuffle" | "loopMode">,
): void => {
  try {
    localStorage.setItem(AUDIO_PERSISTENCE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore persistence errors */
  }
};

// Exported only for unit tests to verify persistence behaviour without
// re-importing the module repeatedly (which is unreliable in Vitest).
export const __loadPersistedPreferencesForTest = loadPersistedPreferences;

interface AudioStore extends AudioState {
  // Actions
  setPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setStopped: (stopped: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setCurrentTrack: (track: AudioTrack | null) => void;
  setPlaylist: (tracks: AudioTrack[]) => void;
  addToPlaylist: (track: AudioTrack) => void;
  updateTrack: (id: string, updates: Partial<AudioTrack>) => void;
  removeFromPlaylist: (index: number) => void;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
  setCurrentTrackIndex: (index: number) => void;
  setLive: (live: boolean) => void;
  setMicrophoneActive: (active: boolean) => void;
  setInputDevice: (device: string | null) => void;
  setShuffle: (shuffle: boolean) => void;
  setLoopMode: (mode: LoopMode) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  playTrack: (index: number) => Promise<void>;
  stopPlayback: () => void;
  togglePlayPause: () => Promise<void>;
  toggleMute: () => void;
  seekTo: (time: number) => void;
  updateVolume: (volume: number) => void;
}

// Load persisted user preferences once during module initialization to
// avoid repeatedly touching localStorage.
const persisted = loadPersistedPreferences();

const initialState: AudioState = {
  isPlaying: false,
  isPaused: false,
  isStopped: true,
  currentTime: MIN_AUDIO_TIME,
  duration: MIN_AUDIO_TIME,
  volume: MAX_VOLUME,
  isMuted: false,
  currentTrack: null,
  playlist: [],
  currentTrackIndex: NO_TRACK_INDEX,
  isLive: false,
  isMicrophoneActive: false,
  inputDevice: null,
  // User preferences loaded from storage
  shuffle: persisted.shuffle,
  loopMode: persisted.loopMode,
};

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => {
    // Encapsulate state updates so that each action applies its changes in a
    // single Zustand transaction. This prevents other updates from interleaving
    // mid-calculation and keeps derived fields consistent.
    const update = (fn: (state: AudioState) => Partial<AudioState>): void => {
      set((state) => fn(state));
    };

    // Sequence of track indexes that have been played while shuffle is active.
    // Maintained to allow deterministic back/forward navigation in shuffle mode.
    let shuffleHistory: number[] = [];
    // Pointer into the shuffleHistory array. A value of NO_HISTORY_INDEX means
    // that no shuffle playback has occurred yet.
    let historyIndex = NO_HISTORY_INDEX;
    return {
      ...initialState,

      setPlaying: (playing) =>
        update(() => ({
          isPlaying: playing,
          isPaused: !playing,
          isStopped: false,
        })),
      setPaused: (paused) =>
        update(() => ({ isPaused: paused, isPlaying: !paused })),
      setStopped: (stopped) =>
        update(() => ({ isStopped: stopped, isPlaying: false, isPaused: false })),
      setCurrentTime: (time) => {
        // Guard against non-finite input; failing fast keeps the store
        // in a consistent state and surfaces programming errors early.
        if (!Number.isFinite(time)) {
          throw new Error("setCurrentTime requires a finite number");
        }
        update((state) => {
          // Clamp provided time to the valid playback window.
          const clamped = Math.max(
            MIN_AUDIO_TIME,
            Math.min(time, state.duration),
          );
          // Avoid redundant state updates that would trigger unnecessary
          // re-renders and subscriber notifications.
          return clamped !== state.currentTime
            ? { currentTime: clamped }
            : {};
        });
      },
      setDuration: (duration) =>
        update(() => ({ duration: Math.max(MIN_AUDIO_TIME, duration) })),
      setVolume: (volume) =>
        update(() => ({
          volume: Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume)),
        })),
      setMuted: (muted) => update(() => ({ isMuted: muted })),
      setCurrentTrack: (track) => update(() => ({ currentTrack: track })),
      setPlaylist: (tracks) => update(() => ({ playlist: tracks })),

      addToPlaylist: (track) =>
        update((state) => ({ playlist: [...state.playlist, track] })),

      updateTrack: (id, updates) =>
        update((state) => {
          const index = state.playlist.findIndex((t) => t.id === id);
          if (index === NO_TRACK_INDEX) return {};
          const updatedTrack = { ...state.playlist[index], ...updates };
          const newPlaylist = [...state.playlist];
          newPlaylist[index] = updatedTrack;
          return {
            playlist: newPlaylist,
            ...(state.currentTrack && state.currentTrack.id === id
              ? { currentTrack: updatedTrack }
              : {}),
          };
        }),

      removeFromPlaylist: (index) => {
        let trackToRemove: AudioTrack | undefined;
        update((state) => {
          trackToRemove = state.playlist[index];
          const newPlaylist = state.playlist.filter((_, i) => i !== index);
          let newCurrentIndex = state.currentTrackIndex;

          if (index <= state.currentTrackIndex && state.currentTrackIndex > 0) {
            newCurrentIndex = state.currentTrackIndex - 1;
          }

          return {
            playlist: newPlaylist,
            currentTrackIndex: newCurrentIndex,
            currentTrack:
              newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null,
          };
        });

        if (trackToRemove) {
          revokeTrackUrl(trackToRemove);
        }
      },

      reorderPlaylist: (fromIndex, toIndex) =>
        update((state) => {
          const newPlaylist = [...state.playlist];
          const [movedTrack] = newPlaylist.splice(fromIndex, 1);
          newPlaylist.splice(toIndex, 0, movedTrack);

          let newCurrentIndex = state.currentTrackIndex;
          if (fromIndex === newCurrentIndex) {
            newCurrentIndex = toIndex;
          } else if (fromIndex < newCurrentIndex && toIndex >= newCurrentIndex) {
            newCurrentIndex--;
          } else if (fromIndex > newCurrentIndex && toIndex <= newCurrentIndex) {
            newCurrentIndex++;
          }

          return {
            playlist: newPlaylist,
            currentTrackIndex: newCurrentIndex,
            currentTrack:
              newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null,
          };
        }),

      setCurrentTrackIndex: (index) =>
        update((state) => {
          const track =
            index >= 0 && index < state.playlist.length
              ? state.playlist[index]
              : null;
          return { currentTrackIndex: index, currentTrack: track };
        }),

      setLive: (live) => update(() => ({ isLive: live })),
      setMicrophoneActive: (active) =>
        update(() => ({ isMicrophoneActive: active })),
      setInputDevice: (device) => update(() => ({ inputDevice: device })),
      setShuffle: (shuffle) => {
        if (typeof shuffle !== "boolean") {
          throw new Error("shuffle must be a boolean");
        }
        update((state) => {
          const current = state.currentTrackIndex;
          shuffleHistory = shuffle && current >= 0 ? [current] : [];
          historyIndex = shuffleHistory.length - 1;
          return { shuffle };
        });
        // Persist alongside current loopMode to maintain coherence
        persistPreferences({ shuffle, loopMode: get().loopMode });
      },
      setLoopMode: (mode) => {
        if (!(mode in VALID_LOOP_MODES)) {
          throw new Error(`Invalid loop mode: ${mode}`);
        }
        update(() => ({ loopMode: mode }));
        // Persist alongside current shuffle state
        persistPreferences({ shuffle: get().shuffle, loopMode: mode });
      },

      nextTrack: async () => {
        let nextTrack: AudioTrack | undefined;
        update((state) => {
          const { playlist, currentTrackIndex, shuffle } = state;
          if (playlist.length === 0) return {};

          let nextIndex = 0;
          if (shuffle) {
            if (historyIndex < shuffleHistory.length - 1) {
              historyIndex++;
              nextIndex = shuffleHistory[historyIndex];
            } else {
              const available = playlist
                .map((_, i) => i)
                .filter(
                  (i) => i !== currentTrackIndex && !shuffleHistory.includes(i),
                );
              if (available.length === 0) {
                shuffleHistory =
                  currentTrackIndex >= 0 ? [currentTrackIndex] : [];
                const rest = playlist
                  .map((_, i) => i)
                  .filter((i) => i !== currentTrackIndex);
                nextIndex = rest[Math.floor(Math.random() * rest.length)];
                shuffleHistory.push(nextIndex);
                historyIndex = shuffleHistory.length - 1;
              } else {
                nextIndex =
                  available[Math.floor(Math.random() * available.length)];
                shuffleHistory.push(nextIndex);
                historyIndex = shuffleHistory.length - 1;
              }
            }
          } else {
            nextIndex = (currentTrackIndex + 1) % playlist.length;
          }
          nextTrack = playlist[nextIndex];
          if (!nextTrack) return {};
          return {
            currentTrackIndex: nextIndex,
            currentTrack: nextTrack,
            isPlaying: true,
            isPaused: false,
            isStopped: false,
            currentTime: MIN_AUDIO_TIME,
          };
        });
        if (nextTrack) {
          await audioPlayer.playTrack(nextTrack);
        }
      },
      previousTrack: async () => {
        let prevTrack: AudioTrack | undefined;
        update((state) => {
          const { playlist, currentTrackIndex, shuffle } = state;
          if (playlist.length === 0) return {};

          let prevIndex = 0;
          if (shuffle) {
            if (historyIndex > 0) {
              historyIndex--;
              prevIndex = shuffleHistory[historyIndex];
            } else {
              const available = playlist
                .map((_, i) => i)
                .filter((i) => i !== currentTrackIndex);
              prevIndex = available[Math.floor(Math.random() * available.length)];
              shuffleHistory.unshift(prevIndex);
              historyIndex = 0;
            }
          } else {
            prevIndex =
              currentTrackIndex <= 0
                ? playlist.length - 1
                : currentTrackIndex - 1;
          }
          prevTrack = playlist[prevIndex];
          if (!prevTrack) return {};
          return {
            currentTrackIndex: prevIndex,
            currentTrack: prevTrack,
            isPlaying: true,
            isPaused: false,
            isStopped: false,
            currentTime: MIN_AUDIO_TIME,
          };
        });
        if (prevTrack) {
          await audioPlayer.playTrack(prevTrack);
        }
      },
      playTrack: async (index) => {
        let track: AudioTrack | undefined;
        update((state) => {
          const { playlist, shuffle } = state;
          if (index < 0 || index >= playlist.length) return {};

          track = playlist[index];
          if (shuffle) {
            shuffleHistory = [
              ...shuffleHistory.slice(0, historyIndex + 1),
              index,
            ];
            historyIndex = shuffleHistory.length - 1;
          }
          return {
            currentTrackIndex: index,
            currentTrack: track,
            isPlaying: true,
            isPaused: false,
            isStopped: false,
            currentTime: MIN_AUDIO_TIME,
          };
        });
        if (track) {
          await audioPlayer.playTrack(track);
        }
      },

      stopPlayback: () => {
        audioPlayer.stopPlayback();
      },
      togglePlayPause: async () => {
        const { isPlaying, isStopped, currentTrack } = get();
        if (isStopped) {
          if (currentTrack) {
            await audioPlayer.playTrack(currentTrack);
          }
        } else if (isPlaying) {
          audioPlayer.pausePlayback();
        } else {
          await audioPlayer.resumePlayback();
        }
      },

      toggleMute: () => {
        audioPlayer.toggleMute();
      },

      seekTo: (time) => {
        if (!Number.isFinite(time)) {
          throw new Error("seekTo requires a finite number");
        }
        audioPlayer.seekTo(Math.max(MIN_AUDIO_TIME, time));
      },

      updateVolume: (volume) => {
        if (!Number.isFinite(volume)) {
          throw new Error("updateVolume requires a finite number");
        }
        audioPlayer.setVolume(
          Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume)),
        );
      },
    };
  }),
);

// Selectors keep components decoupled from the store shape and help
// minimize re-renders by allowing narrow subscriptions.
export const selectShuffle = (state: AudioStore) => state.shuffle;
export const selectLoopMode = (state: AudioStore) => state.loopMode;
