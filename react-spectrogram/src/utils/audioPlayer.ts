import type { AudioTrack } from '@/types'
import {
  playbackEngine,
  type PlaybackState,
  type PlaybackCallback
} from './PlaybackEngine'

// Legacy wrapper mapping old AudioPlayer API to PlaybackEngine

export const audioPlayer = {
  initAudioContext: async () => {
    if (typeof playbackEngine.initializeAudioContext === 'function') {
      return await playbackEngine.initializeAudioContext();
    }
    // Fallback to getAudioContext if no async initializer is available
    const ctx = playbackEngine.getAudioContext();
    if (!ctx) {
      throw new Error('AudioContext could not be initialized.');
    }
    return ctx;
  },

  playTrack: async (track: AudioTrack, startAt = 0) => {
    await playbackEngine.load(track)
    playbackEngine.play(startAt)
  },

  pausePlayback: () => playbackEngine.pause(),
  resumePlayback: () => playbackEngine.resume(),
  stopPlayback: () => playbackEngine.stop(),
  seekTo: (time: number) => playbackEngine.seek(time),
  setVolume: (v: number) => playbackEngine.setVolume(v),
  toggleMute: () => playbackEngine.toggleMute(),
  getAudioContext: () => playbackEngine.getAudioContext(),
  getDuration: () => playbackEngine.getDuration(),
  getCurrentTime: () => playbackEngine.getCurrentTime(),
  isPlaying: () => playbackEngine.isPlaying(),
  isStopped: () => playbackEngine.isStopped(),
  cleanup: () => playbackEngine.cleanup(),
  subscribe: playbackEngine.subscribe.bind(playbackEngine)
}

export type AudioPlayerState = PlaybackState
export type AudioPlayerCallback = PlaybackCallback
