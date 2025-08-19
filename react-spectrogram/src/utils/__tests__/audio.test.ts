import { describe, it, expect } from 'vitest'
import { 
  isAudioFile, 
  formatDuration, 
  formatFileSize, 
  generateTrackId,
  createAudioTrack 
} from '../audio'

describe('Audio Utils', () => {
  describe('isAudioFile', () => {
    it('returns true for valid audio files', () => {
      const mp3File = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const wavFile = new File([''], 'test.wav', { type: 'audio/wav' })
      const flacFile = new File([''], 'test.flac', { type: 'audio/flac' })
      
      expect(isAudioFile(mp3File)).toBe(true)
      expect(isAudioFile(wavFile)).toBe(true)
      expect(isAudioFile(flacFile)).toBe(true)
    })

    it('returns false for non-audio files', () => {
      const textFile = new File([''], 'test.txt', { type: 'text/plain' })
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      
      expect(isAudioFile(textFile)).toBe(false)
      expect(isAudioFile(imageFile)).toBe(false)
    })

    it('handles files without MIME type', () => {
      const mp3File = new File([''], 'test.mp3')
      const txtFile = new File([''], 'test.txt')
      
      expect(isAudioFile(mp3File)).toBe(true)
      expect(isAudioFile(txtFile)).toBe(false)
    })
  })

  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(30)).toBe('0:30')
      expect(formatDuration(65)).toBe('1:05')
      expect(formatDuration(125)).toBe('2:05')
    })

    it('formats hours correctly', () => {
      expect(formatDuration(3600)).toBe('1:00:00')
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(7325)).toBe('2:02:05')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0.0 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1048576)).toBe('1.0 MB')
      expect(formatFileSize(1073741824)).toBe('1.0 GB')
    })

    it('handles decimal sizes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1572864)).toBe('1.5 MB')
    })
  })

  describe('generateTrackId', () => {
    it('generates unique IDs', () => {
      const id1 = generateTrackId()
      const id2 = generateTrackId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^track_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^track_\d+_[a-z0-9]+$/)
    })
  })

  describe('createAudioTrack', () => {
    it('creates track with correct properties', () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const metadata = {
        title: 'Test Song',
        artist: 'Test Artist',
        duration: 120,
      }
      
      const track = createAudioTrack(file, metadata)
      
      expect(track.id).toMatch(/^track_\d+_[a-z0-9]+$/)
      expect(track.file).toBe(file)
      expect(track.metadata).toBe(metadata)
      expect(track.duration).toBe(120)
      expect(track.url).toMatch(/^blob:/)
    })
  })
})
