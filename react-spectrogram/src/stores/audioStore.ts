import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { AudioState, AudioTrack } from '@/types'
import { playbackEngine } from '@/utils/PlaybackEngine'
import { audioPlayer } from '@/utils/audioPlayer'
import { revokeTrackUrl } from '@/utils/audio'

interface AudioStore extends AudioState {
  // Actions
  setPlaying: (playing: boolean) => void
  setPaused: (paused: boolean) => void
  setStopped: (stopped: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setCurrentTrack: (track: AudioTrack | null) => void
  setPlaylist: (tracks: AudioTrack[]) => void
  addToPlaylist: (track: AudioTrack) => void
  removeFromPlaylist: (index: number) => void
  reorderPlaylist: (fromIndex: number, toIndex: number) => void
  setCurrentTrackIndex: (index: number) => void
  setLive: (live: boolean) => void
  setMicrophoneActive: (active: boolean) => void
  setInputDevice: (device: string | null) => void
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  playTrack: (index: number) => Promise<void>
  stopPlayback: () => void
  togglePlayPause: () => Promise<void>
  toggleMute: () => void
  seekTo: (time: number) => void
  updateVolume: (volume: number) => void
}

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
}

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setPlaying: (playing) => set({ isPlaying: playing, isPaused: !playing, isStopped: false }),
    setPaused: (paused) => set({ isPaused: paused, isPlaying: !paused }),
    setStopped: (stopped) => set({ isStopped: stopped, isPlaying: false, isPaused: false }),
    setCurrentTime: (time) => set({ currentTime: Math.max(0, Math.min(time, get().duration)) }),
    setDuration: (duration) => set({ duration: Math.max(0, duration) }),
    setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    setMuted: (muted) => set({ isMuted: muted }),
    setCurrentTrack: (track) => set({ currentTrack: track }),
    setPlaylist: (tracks) => set({ playlist: tracks }),
    
    addToPlaylist: (track) => {
      const { playlist } = get()
      set({ playlist: [...playlist, track] })
    },
    
    removeFromPlaylist: (index) => {
      const { playlist, currentTrackIndex } = get()
      const trackToRemove = playlist[index]
      const newPlaylist = playlist.filter((_, i) => i !== index)
      let newCurrentIndex = currentTrackIndex

      if (index <= currentTrackIndex && currentTrackIndex > 0) {
        newCurrentIndex = currentTrackIndex - 1
      }

      set({
        playlist: newPlaylist,
        currentTrackIndex: newCurrentIndex,
        currentTrack: newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null
      })

      if (trackToRemove) {
        revokeTrackUrl(trackToRemove)
      }
    },
    
    reorderPlaylist: (fromIndex, toIndex) => {
      const { playlist } = get()
      const newPlaylist = [...playlist]
      const [movedTrack] = newPlaylist.splice(fromIndex, 1)
      newPlaylist.splice(toIndex, 0, movedTrack)
      
      let newCurrentIndex = get().currentTrackIndex
      if (fromIndex === newCurrentIndex) {
        newCurrentIndex = toIndex
      } else if (fromIndex < newCurrentIndex && toIndex >= newCurrentIndex) {
        newCurrentIndex--
      } else if (fromIndex > newCurrentIndex && toIndex <= newCurrentIndex) {
        newCurrentIndex++
      }
      
      set({ 
        playlist: newPlaylist,
        currentTrackIndex: newCurrentIndex,
        currentTrack: newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null
      })
    },
    
    setCurrentTrackIndex: (index) => {
      const { playlist } = get()
      const track = index >= 0 && index < playlist.length ? playlist[index] : null
      set({ currentTrackIndex: index, currentTrack: track })
    },
    
    setLive: (live) => set({ isLive: live }),
    setMicrophoneActive: (active) => set({ isMicrophoneActive: active }),
    setInputDevice: (device) => set({ inputDevice: device }),
    
    nextTrack: async () => {
      const { playlist, currentTrackIndex } = get()
      if (playlist.length === 0) return

      const nextIndex = (currentTrackIndex + 1) % playlist.length
      const nextTrack = playlist[nextIndex]
      if (nextTrack) {
        set({
          currentTrackIndex: nextIndex,
          currentTrack: nextTrack,
          isPlaying: true,
          isPaused: false,
          isStopped: false,
          currentTime: 0
        })
        // Actually play the track
        await audioPlayer.playTrack(nextTrack)
      }
    },
    previousTrack: async () => {
      const { playlist, currentTrackIndex } = get()
      if (playlist.length === 0) return

      const prevIndex = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1
      const prevTrack = playlist[prevIndex]
      if (prevTrack) {
        set({
          currentTrackIndex: prevIndex,
          currentTrack: prevTrack,
          isPlaying: true,
          isPaused: false,
          isStopped: false,
          currentTime: 0
        })
        // Actually play the track
        await audioPlayer.playTrack(prevTrack)
      }
    },
    playTrack: async (index) => {
      const { playlist } = get()
      if (index < 0 || index >= playlist.length) return

      const track = playlist[index]
      set({
        currentTrackIndex: index,
        currentTrack: track,
        isPlaying: true,
        isPaused: false,
        isStopped: false,
        currentTime: 0
      })
      // Actually play the track
      await audioPlayer.playTrack(track)
    },

    stopPlayback: () => {
      audioPlayer.stopPlayback()
    },
    togglePlayPause: async () => {
      const { isPlaying, isStopped, currentTrack } = get()
      if (isStopped) {
        if (currentTrack) {
          await audioPlayer.playTrack(currentTrack)
        }
      } else if (isPlaying) {
        audioPlayer.pausePlayback()
      } else {
        await audioPlayer.resumePlayback()
      }
    },

    toggleMute: () => {
      audioPlayer.toggleMute()
    },

    seekTo: (time) => {
      audioPlayer.seekTo(time)
    },

    updateVolume: (volume) => {
      audioPlayer.setVolume(volume)
    },
  }))
)
