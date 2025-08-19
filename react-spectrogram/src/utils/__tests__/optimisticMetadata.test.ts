import { optimisticMetadataStore, computeOptimisticKey, computeContentFingerprint } from '../optimisticMetadataStore'
import { metadataVerificationWorker } from '../metadataVerificationWorker'
import { metadataTelemetry } from '../metadataTelemetry'
import { AudioMetadata } from '@/types'

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
}

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
})

// Mock crypto.subtle for testing
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new Uint8Array(32))
    }
  },
  writable: true
})

describe('Optimistic Metadata System', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Reset telemetry
    metadataTelemetry.clear()
    
    // Mock IndexedDB implementation
    const mockDB = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn().mockReturnValue({ result: 1 }),
          get: jest.fn().mockReturnValue({ result: null }),
          put: jest.fn(),
          delete: jest.fn(),
          index: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue({ result: null }),
            openCursor: jest.fn().mockReturnValue({ result: null })
          }),
          count: jest.fn().mockReturnValue({ result: 0 }),
          getAll: jest.fn().mockReturnValue({ result: [] }),
          clear: jest.fn()
        }),
        oncomplete: null,
        onerror: null
      }),
      createObjectStore: jest.fn().mockReturnValue({
        createIndex: jest.fn()
      })
    }

    mockIndexedDB.open.mockReturnValue({
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: mockDB
    })
  })

  describe('computeOptimisticKey', () => {
    it('should generate consistent keys for same filename and size', () => {
      const key1 = computeOptimisticKey('test.mp3', 1024)
      const key2 = computeOptimisticKey('test.mp3', 1024)
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different files', () => {
      const key1 = computeOptimisticKey('test1.mp3', 1024)
      const key2 = computeOptimisticKey('test2.mp3', 1024)
      expect(key1).not.toBe(key2)
    })

    it('should be case insensitive', () => {
      const key1 = computeOptimisticKey('Test.MP3', 1024)
      const key2 = computeOptimisticKey('test.mp3', 1024)
      expect(key1).toBe(key2)
    })

    it('should handle different file sizes', () => {
      const key1 = computeOptimisticKey('test.mp3', 1024)
      const key2 = computeOptimisticKey('test.mp3', 2048)
      expect(key1).not.toBe(key2)
    })
  })

  describe('computeContentFingerprint', () => {
    it('should generate fingerprints for array buffers', async () => {
      const buffer = new ArrayBuffer(1000)
      const fingerprint = await computeContentFingerprint(buffer)
      expect(fingerprint).toBeDefined()
      expect(typeof fingerprint).toBe('string')
    })

    it('should generate consistent fingerprints for same content', async () => {
      const buffer1 = new ArrayBuffer(1000)
      const buffer2 = new ArrayBuffer(1000)
      
      const fp1 = await computeContentFingerprint(buffer1)
      const fp2 = await computeContentFingerprint(buffer2)
      
      expect(fp1).toBe(fp2)
    })

    it('should generate different fingerprints for different content', async () => {
      const buffer1 = new Uint8Array(1000).buffer
      const buffer2 = new Uint8Array(1000).buffer
      buffer2[0] = 1 // Different content
      
      const fp1 = await computeContentFingerprint(buffer1)
      const fp2 = await computeContentFingerprint(buffer2)
      
      expect(fp1).not.toBe(fp2)
    })
  })

  describe('OptimisticMetadataStore', () => {
    it('should initialize successfully', async () => {
      const store = optimisticMetadataStore
      await expect(store.init()).resolves.toBeDefined()
    })

    it('should store and retrieve optimistic metadata', async () => {
      const fileName = 'test.mp3'
      const fileSize = 1024
      const metadata: AudioMetadata = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        format: 'mp3'
      }
      const arrayBuffer = new ArrayBuffer(100)

      // Mock successful storage
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn().mockReturnValue({ result: 1 }),
          index: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue({ result: null })
          })
        }),
        oncomplete: null,
        onerror: null
      }

      mockIndexedDB.open.mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          transaction: jest.fn().mockReturnValue(mockTransaction),
          createObjectStore: jest.fn().mockReturnValue({
            createIndex: jest.fn()
          })
        }
      })

      const result = await optimisticMetadataStore.storeOptimisticMetadata(
        fileName,
        fileSize,
        metadata,
        arrayBuffer
      )

      expect(result.key).toBeDefined()
      expect(result.metadataKey).toBeDefined()
    })

    it('should handle cache misses gracefully', async () => {
      const fileName = 'nonexistent.mp3'
      const fileSize = 1024

      // Mock empty result
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          index: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue({ result: null })
          })
        }),
        oncomplete: null,
        onerror: null
      }

      mockIndexedDB.open.mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          transaction: jest.fn().mockReturnValue(mockTransaction),
          createObjectStore: jest.fn().mockReturnValue({
            createIndex: jest.fn()
          })
        }
      })

      const result = await optimisticMetadataStore.getOptimisticMetadata(fileName, fileSize)
      
      expect(result.metadata).toBeNull()
      expect(result.artwork).toBeNull()
      expect(result.trackIndex).toBeNull()
    })
  })

  describe('MetadataVerificationWorker', () => {
    it('should add verification tasks to queue', async () => {
      const fileName = 'test.mp3'
      const fileSize = 1024
      const arrayBuffer = new ArrayBuffer(100)
      const priority = 5

      await metadataVerificationWorker.addVerificationTask(
        fileName,
        fileSize,
        arrayBuffer,
        priority
      )

      const status = metadataVerificationWorker.getQueueStatus()
      expect(status.queueSize).toBeGreaterThan(0)
    })

    it('should provide queue status', () => {
      const status = metadataVerificationWorker.getQueueStatus()
      
      expect(status).toHaveProperty('queueSize')
      expect(status).toHaveProperty('processingCount')
      expect(status).toHaveProperty('isRunning')
      expect(status).toHaveProperty('isPaused')
    })

    it('should provide worker statistics', () => {
      const stats = metadataVerificationWorker.getStats()
      
      expect(stats).toHaveProperty('processed')
      expect(stats).toHaveProperty('succeeded')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('collisions')
      expect(stats).toHaveProperty('retries')
    })
  })

  describe('MetadataTelemetry', () => {
    it('should record cache hits', () => {
      const key = 'test-key'
      const fileName = 'test.mp3'
      const fileSize = 1024
      const duration = 25
      const metadata = { title: 'Test', artist: 'Artist', verified: true }

      metadataTelemetry.recordCacheHit(key, fileName, fileSize, duration, metadata)

      const stats = metadataTelemetry.getStats()
      expect(stats.cacheHits).toBe(1)
      expect(stats.averageCacheHitTime).toBe(duration)
    })

    it('should record cache misses', () => {
      const fileName = 'test.mp3'
      const fileSize = 1024

      metadataTelemetry.recordCacheMiss(fileName, fileSize)

      const stats = metadataTelemetry.getStats()
      expect(stats.cacheMisses).toBe(1)
    })

    it('should record verification events', () => {
      const key = 'test-key'
      const fileName = 'test.mp3'
      const fileSize = 1024
      const duration = 3000
      const metadata = { title: 'Test', artist: 'Artist' }

      metadataTelemetry.recordVerificationStart(key, fileName, fileSize)
      metadataTelemetry.recordVerificationComplete(key, fileName, fileSize, duration, metadata)

      const stats = metadataTelemetry.getStats()
      expect(stats.verificationsStarted).toBe(1)
      expect(stats.verificationsCompleted).toBe(1)
      expect(stats.averageVerificationTime).toBe(duration)
    })

    it('should record verification failures', () => {
      const key = 'test-key'
      const fileName = 'test.mp3'
      const fileSize = 1024
      const error = 'Test error'

      metadataTelemetry.recordVerificationFailed(key, fileName, fileSize, error)

      const stats = metadataTelemetry.getStats()
      expect(stats.verificationsFailed).toBe(1)
    })

    it('should record collisions', () => {
      const key = 'test-key'
      const fileName = 'test.mp3'
      const fileSize = 1024

      metadataTelemetry.recordCollisionDetected(key, fileName, fileSize)

      const stats = metadataTelemetry.getStats()
      expect(stats.collisionsDetected).toBe(1)
    })

    it('should calculate cache hit rate correctly', () => {
      // Record 8 hits and 2 misses
      for (let i = 0; i < 8; i++) {
        metadataTelemetry.recordCacheHit(`key-${i}`, 'test.mp3', 1024, 25, {})
      }
      for (let i = 0; i < 2; i++) {
        metadataTelemetry.recordCacheMiss('test.mp3', 1024)
      }

      const stats = metadataTelemetry.getStats()
      expect(stats.cacheHitRate).toBe(0.8) // 80%
    })

    it('should calculate verification success rate correctly', () => {
      // Record 9 successes and 1 failure
      for (let i = 0; i < 9; i++) {
        metadataTelemetry.recordVerificationComplete(`key-${i}`, 'test.mp3', 1024, 3000, {})
      }
      metadataTelemetry.recordVerificationFailed('key-fail', 'test.mp3', 1024, 'error')

      const stats = metadataTelemetry.getStats()
      expect(stats.verificationSuccessRate).toBe(0.9) // 90%
    })

    it('should provide performance insights', () => {
      // Add some test data
      for (let i = 0; i < 8; i++) {
        metadataTelemetry.recordCacheHit(`key-${i}`, 'test.mp3', 1024, 25, {})
      }
      for (let i = 0; i < 2; i++) {
        metadataTelemetry.recordCacheMiss('test.mp3', 1024)
      }

      const insights = metadataTelemetry.getPerformanceInsights()
      
      expect(insights).toHaveProperty('cachePerformance')
      expect(insights).toHaveProperty('verificationPerformance')
      expect(insights).toHaveProperty('recommendations')
      expect(Array.isArray(insights.recommendations)).toBe(true)
    })

    it('should export data correctly', () => {
      // Add some test data
      metadataTelemetry.recordCacheHit('test-key', 'test.mp3', 1024, 25, {})
      metadataTelemetry.recordCacheMiss('test.mp3', 1024)

      const data = metadataTelemetry.exportData()
      
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('events')
      expect(data).toHaveProperty('insights')
      expect(data.events.length).toBeGreaterThan(0)
    })

    it('should clear data correctly', () => {
      // Add some test data
      metadataTelemetry.recordCacheHit('test-key', 'test.mp3', 1024, 25, {})
      
      // Verify data exists
      let stats = metadataTelemetry.getStats()
      expect(stats.totalEvents).toBeGreaterThan(0)
      
      // Clear data
      metadataTelemetry.clear()
      
      // Verify data is cleared
      stats = metadataTelemetry.getStats()
      expect(stats.totalEvents).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
    })
  })

  describe('Integration', () => {
    it('should handle the complete optimistic metadata flow', async () => {
      const fileName = 'integration-test.mp3'
      const fileSize = 2048
      const metadata: AudioMetadata = {
        title: 'Integration Test',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 240,
        format: 'mp3'
      }
      const arrayBuffer = new ArrayBuffer(200)

      // Test key generation
      const key = computeOptimisticKey(fileName, fileSize)
      expect(key).toBeDefined()

      // Test content fingerprinting
      const fingerprint = await computeContentFingerprint(arrayBuffer)
      expect(fingerprint).toBeDefined()

      // Test telemetry recording
      metadataTelemetry.recordCacheHit(key, fileName, fileSize, 30, metadata)
      const stats = metadataTelemetry.getStats()
      expect(stats.cacheHits).toBe(1)

      // Test verification worker
      await metadataVerificationWorker.addVerificationTask(fileName, fileSize, arrayBuffer, 1)
      const queueStatus = metadataVerificationWorker.getQueueStatus()
      expect(queueStatus.queueSize).toBeGreaterThan(0)
    })
  })
})
