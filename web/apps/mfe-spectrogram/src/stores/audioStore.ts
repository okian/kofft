import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { AudioState, AudioTrack, LoopMode } from "@/types";
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
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  currentTrack: null,
  playlist: [],
  currentTrackIndex: -1,
  isLive: false,
  isMicrophoneActive: false,
  inputDevice: null,
  // User preferences loaded from storage
  shuffle: persisted.shuffle,
  loopMode: persisted.loopMode,
};

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => {
    let shuffleHistory: number[] = [];
    let historyIndex = -1;
    return {
      ...initialState,

      setPlaying: (playing) =>
        set({ isPlaying: playing, isPaused: !playing, isStopped: false }),
      setPaused: (paused) => set({ isPaused: paused, isPlaying: !paused }),
      setStopped: (stopped) =>
        set({ isStopped: stopped, isPlaying: false, isPaused: false }),
      setCurrentTime: (time) => {
        // Guard against non-finite input; failing fast keeps the store
        // in a consistent state and surfaces programming errors early.
        if (!Number.isFinite(time)) {
          throw new Error("setCurrentTime requires a finite number");
        }
        const { currentTime, duration } = get();
        // Clamp provided time to the valid playback window.
        const clamped = Math.max(MIN_AUDIO_TIME, Math.min(time, duration));
        // Avoid redundant state updates that would trigger unnecessary
        // re-renders and subscriber notifications.
        if (clamped !== currentTime) {
          set({ currentTime: clamped });
        }
      },
      setDuration: (duration) => set({ duration: Math.max(0, duration) }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMuted: (muted) => set({ isMuted: muted }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setPlaylist: (tracks) => set({ playlist: tracks }),

      addToPlaylist: (track) => {
        const { playlist } = get();
        set({ playlist: [...playlist, track] });
      },

      updateTrack: (id, updates) => {
        const { playlist, currentTrack } = get();
        const index = playlist.findIndex((t) => t.id === id);
        if (index === -1) return;
        const updatedTrack = { ...playlist[index], ...updates };
        const newPlaylist = [...playlist];
        newPlaylist[index] = updatedTrack;
        const newState: Partial<AudioState> & { playlist: AudioTrack[] } = {
          playlist: newPlaylist,
        };
        if (currentTrack && currentTrack.id === id) {
          newState.currentTrack = updatedTrack;
        }
        set(newState);
      },

      removeFromPlaylist: (index) => {
        const { playlist, currentTrackIndex } = get();
        const trackToRemove = playlist[index];
        const newPlaylist = playlist.filter((_, i) => i !== index);
        let newCurrentIndex = currentTrackIndex;

        if (index <= currentTrackIndex && currentTrackIndex > 0) {
          newCurrentIndex = currentTrackIndex - 1;
        }

        set({
          playlist: newPlaylist,
          currentTrackIndex: newCurrentIndex,
          currentTrack:
            newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null,
        });

        if (trackToRemove) {
          revokeTrackUrl(trackToRemove);
        }
      },

      reorderPlaylist: (fromIndex, toIndex) => {
        const { playlist } = get();
        const newPlaylist = [...playlist];
        const [movedTrack] = newPlaylist.splice(fromIndex, 1);
        newPlaylist.splice(toIndex, 0, movedTrack);

        let newCurrentIndex = get().currentTrackIndex;
        if (fromIndex === newCurrentIndex) {
          newCurrentIndex = toIndex;
        } else if (fromIndex < newCurrentIndex && toIndex >= newCurrentIndex) {
          newCurrentIndex--;
        } else if (fromIndex > newCurrentIndex && toIndex <= newCurrentIndex) {
          newCurrentIndex++;
        }

        set({
          playlist: newPlaylist,
          currentTrackIndex: newCurrentIndex,
          currentTrack:
            newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null,
        });
      },

      setCurrentTrackIndex: (index) => {
        const { playlist } = get();
        const track =
          index >= 0 && index < playlist.length ? playlist[index] : null;
        set({ currentTrackIndex: index, currentTrack: track });
      },

      setLive: (live) => set({ isLive: live }),
      setMicrophoneActive: (active) => set({ isMicrophoneActive: active }),
      setInputDevice: (device) => set({ inputDevice: device }),
      setShuffle: (shuffle) => {
        if (typeof shuffle !== "boolean") {
          throw new Error("shuffle must be a boolean");
        }
        const current = get().currentTrackIndex;
        shuffleHistory = shuffle && current >= 0 ? [current] : [];
        historyIndex = shuffleHistory.length - 1;
        set({ shuffle });
        // Persist alongside current loopMode to maintain coherence
        persistPreferences({ shuffle, loopMode: get().loopMode });
      },
      setLoopMode: (mode) => {
        if (!(mode in VALID_LOOP_MODES)) {
          throw new Error(`Invalid loop mode: ${mode}`);
        }
        set({ loopMode: mode });
        // Persist alongside current shuffle state
        persistPreferences({ shuffle: get().shuffle, loopMode: mode });
      },

      nextTrack: async () => {
        const { playlist, currentTrackIndex, shuffle } = get();
        if (playlist.length === 0) return;

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
        const nextTrack = playlist[nextIndex];
        if (nextTrack) {
          set({
            currentTrackIndex: nextIndex,
            currentTrack: nextTrack,
            isPlaying: true,
            isPaused: false,
            isStopped: false,
            currentTime: 0,
          });
          await audioPlayer.playTrack(nextTrack);
        }
      },
      previousTrack: async () => {
        const { playlist, currentTrackIndex, shuffle } = get();
        if (playlist.length === 0) return;

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
        const prevTrack = playlist[prevIndex];
        if (prevTrack) {
          set({
            currentTrackIndex: prevIndex,
            currentTrack: prevTrack,
            isPlaying: true,
            isPaused: false,
            isStopped: false,
            currentTime: 0,
          });
          await audioPlayer.playTrack(prevTrack);
        }
      },
      playTrack: async (index) => {
        const { playlist, shuffle } = get();
        if (index < 0 || index >= playlist.length) return;

        const track = playlist[index];
        if (shuffle) {
          shuffleHistory = [
            ...shuffleHistory.slice(0, historyIndex + 1),
            index,
          ];
          historyIndex = shuffleHistory.length - 1;
        }
        set({
          currentTrackIndex: index,
          currentTrack: track,
          isPlaying: true,
          isPaused: false,
          isStopped: false,
          currentTime: 0,
        });
        await audioPlayer.playTrack(track);
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
        audioPlayer.seekTo(time);
      },

      updateVolume: (volume) => {
        audioPlayer.setVolume(volume);
      },
    };
  }),
);

// Selectors keep components decoupled from the store shape and help
// minimize re-renders by allowing narrow subscriptions.
export const selectShuffle = (state: AudioStore) => state.shuffle;
export const selectLoopMode = (state: AudioStore) => state.loopMode;
