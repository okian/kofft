import { AudioMetadata, ArtworkSource } from '@/types'
import { metadataTelemetry } from './metadataTelemetry'

// Database configuration for optimistic metadata
const OPTIMISTIC_DB_NAME = 'OptimisticMetadataDB'
const OPTIMISTIC_DB_VERSION = 1

// Store names for optimistic metadata
const OPTIMISTIC_STORES = {
  TRACK_INDEX: 'track_index',
  METADATA_CACHE: 'metadata_cache',
  ARTWORK_CACHE: 'artwork_cache',
  VERIFICATION_QUEUE: 'verification_queue'
} as const

// Index names for efficient queries
const OPTIMISTIC_INDEXES = {
  TRACK_INDEX: {
    KEY: 'key',
    FILE_NAME: 'file_name',
    FILE_SIZE: 'file_size',
    LAST_ACCESSED: 'last_accessed'
  },
  METADATA_CACHE: {
    KEY: 'key',
    ARTIST: 'artist',
    ALBUM: 'album',
    TITLE: 'title',
    VERIFIED: 'verified'
  },
  ARTWORK_CACHE: {
    KEY: 'key',
    ALBUM_ARTIST: 'album_artist',
    LAST_USED: 'last_used',
    SIZE: 'size'
  },
  VERIFICATION_QUEUE: {
    KEY: 'key',
    PRIORITY: 'priority',
    CREATED_AT: 'created_at'
  }
} as const

// Database schema interfaces for optimistic metadata
export interface TrackIndexRecord {
  id?: number
  key: string // hash(fileName.toLowerCase() + ":" + fileSize)
  file_name: string // Original file name (preserved for display)
  file_name_lower: string // Lowercase for case-insensitive lookup
  file_size: number
  content_fingerprint?: string // Lightweight content hash for collision detection
  metadata_cache_key: string
  artwork_cache_key?: string
  created_at: Date
  last_accessed: Date
  access_count: number
  verified: boolean
  superseded_by?: string // Key of the track that superseded this one
}

export interface OptimisticMetadataRecord {
  id?: number
  key: string
  title: string
  artist: string
  album: string
  year?: number
  genre?: string
  duration: number
  sample_rate: number
  channels: number
  bit_depth: number
  bitrate: number
  format: string
  album_art_mime?: string
  verified: boolean
  verification_hash?: string // Full content hash when verified
  created_at: Date
  updated_at: Date
  verified_at?: Date
}

export interface OptimisticArtworkRecord {
  id?: number
  key: string
  data: Uint8Array
  mime_type: string
  size: number
  album_artist?: string
  created_at: Date
  last_used: Date
  use_count: number
}

export interface VerificationQueueRecord {
  id?: number
  key: string
  priority: number // Higher = more important
  retry_count: number
  created_at: Date
  last_attempt?: Date
  error_message?: string
}

// Utility to compute stable key from file name and size
export function computeOptimisticKey(fileName: string, fileSize: number): string {
  const normalizedName = fileName.toLowerCase().trim()
  const keyString = `${normalizedName}:${fileSize}`
  
  // Use a simple hash for the key (not cryptographic, just for uniqueness)
  let hash = 0
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36) + '_' + fileSize.toString(36)
}

// Utility to compute lightweight content fingerprint
export async function computeContentFingerprint(arrayBuffer: ArrayBuffer, sampleSize: number = 1024): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer)
  const length = uint8Array.length
  
  // Sample from beginning, middle, and end of the file
  const samples: number[] = []
  
  // Beginning sample
  for (let i = 0; i < Math.min(sampleSize, length); i++) {
    samples.push(uint8Array[i])
  }
  
  // Middle sample
  const middleStart = Math.floor(length / 2) - Math.floor(sampleSize / 2)
  for (let i = middleStart; i < Math.min(middleStart + sampleSize, length); i++) {
    if (i >= 0) samples.push(uint8Array[i])
  }
  
  // End sample
  const endStart = Math.max(0, length - sampleSize)
  for (let i = endStart; i < length; i++) {
    samples.push(uint8Array[i])
  }
  
  // Simple hash of the samples
  let hash = 0
  for (const sample of samples) {
    hash = ((hash << 5) - hash) + sample
    hash = hash & hash
  }
  
  return Math.abs(hash).toString(36)
}

// Utility to compute full content hash for verification
export async function computeVerificationHash(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

class OptimisticMetadataStore {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null
  private writeQueue: Array<() => Promise<void>> = []
  private isProcessingQueue = false

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(OPTIMISTIC_DB_NAME, OPTIMISTIC_DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open Optimistic IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ Optimistic IndexedDB initialized successfully')
        resolve(this.db!)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log('🔧 Creating Optimistic IndexedDB schema...')

        // Create track index store
        const trackIndexStore = db.createObjectStore(OPTIMISTIC_STORES.TRACK_INDEX, { keyPath: 'id', autoIncrement: true })
        trackIndexStore.createIndex(OPTIMISTIC_INDEXES.TRACK_INDEX.KEY, 'key', { unique: true })
        trackIndexStore.createIndex(OPTIMISTIC_INDEXES.TRACK_INDEX.FILE_NAME, 'file_name_lower', { unique: false })
        trackIndexStore.createIndex(OPTIMISTIC_INDEXES.TRACK_INDEX.FILE_SIZE, 'file_size', { unique: false })
        trackIndexStore.createIndex(OPTIMISTIC_INDEXES.TRACK_INDEX.LAST_ACCESSED, 'last_accessed', { unique: false })

        // Create metadata cache store
        const metadataCacheStore = db.createObjectStore(OPTIMISTIC_STORES.METADATA_CACHE, { keyPath: 'id', autoIncrement: true })
        metadataCacheStore.createIndex(OPTIMISTIC_INDEXES.METADATA_CACHE.KEY, 'key', { unique: true })
        metadataCacheStore.createIndex(OPTIMISTIC_INDEXES.METADATA_CACHE.ARTIST, 'artist', { unique: false })
        metadataCacheStore.createIndex(OPTIMISTIC_INDEXES.METADATA_CACHE.ALBUM, 'album', { unique: false })
        metadataCacheStore.createIndex(OPTIMISTIC_INDEXES.METADATA_CACHE.TITLE, 'title', { unique: false })
        metadataCacheStore.createIndex(OPTIMISTIC_INDEXES.METADATA_CACHE.VERIFIED, 'verified', { unique: false })

        // Create artwork cache store
        const artworkCacheStore = db.createObjectStore(OPTIMISTIC_STORES.ARTWORK_CACHE, { keyPath: 'id', autoIncrement: true })
        artworkCacheStore.createIndex(OPTIMISTIC_INDEXES.ARTWORK_CACHE.KEY, 'key', { unique: true })
        artworkCacheStore.createIndex(OPTIMISTIC_INDEXES.ARTWORK_CACHE.ALBUM_ARTIST, 'album_artist', { unique: false })
        artworkCacheStore.createIndex(OPTIMISTIC_INDEXES.ARTWORK_CACHE.LAST_USED, 'last_used', { unique: false })
        artworkCacheStore.createIndex(OPTIMISTIC_INDEXES.ARTWORK_CACHE.SIZE, 'size', { unique: false })

        // Create verification queue store
        const verificationQueueStore = db.createObjectStore(OPTIMISTIC_STORES.VERIFICATION_QUEUE, { keyPath: 'id', autoIncrement: true })
        verificationQueueStore.createIndex(OPTIMISTIC_INDEXES.VERIFICATION_QUEUE.KEY, 'key', { unique: true })
        verificationQueueStore.createIndex(OPTIMISTIC_INDEXES.VERIFICATION_QUEUE.PRIORITY, 'priority', { unique: false })
        verificationQueueStore.createIndex(OPTIMISTIC_INDEXES.VERIFICATION_QUEUE.CREATED_AT, 'created_at', { unique: false })

        console.log('✅ Optimistic IndexedDB schema created successfully')
      }
    })

    return this.initPromise
  }

  // Fast path: Get optimistic metadata by file name and size
  async getOptimisticMetadata(fileName: string, fileSize: number): Promise<{
    metadata: OptimisticMetadataRecord | null
    artwork: OptimisticArtworkRecord | null
    trackIndex: TrackIndexRecord | null
  }> {
    const db = await this.init()
    const key = computeOptimisticKey(fileName, fileSize)
    const now = new Date()
    const startTime = performance.now()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        OPTIMISTIC_STORES.TRACK_INDEX,
        OPTIMISTIC_STORES.METADATA_CACHE,
        OPTIMISTIC_STORES.ARTWORK_CACHE
      ], 'readwrite')

      // Get track index record
      const trackIndexStore = transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX)
      const trackIndexRequest = trackIndexStore.index(OPTIMISTIC_INDEXES.TRACK_INDEX.KEY).get(key)

      trackIndexRequest.onsuccess = () => {
        const trackIndex = trackIndexRequest.result as TrackIndexRecord | null

        if (!trackIndex) {
          const duration = performance.now() - startTime
          metadataTelemetry.recordCacheMiss(fileName, fileSize)
          resolve({ metadata: null, artwork: null, trackIndex: null })
          return
        }

        // Update access statistics
        trackIndex.last_accessed = now
        trackIndex.access_count += 1
        trackIndexStore.put(trackIndex)

        // Get metadata
        const metadataCacheStore = transaction.objectStore(OPTIMISTIC_STORES.METADATA_CACHE)
        const metadataRequest = metadataCacheStore.index(OPTIMISTIC_INDEXES.METADATA_CACHE.KEY).get(trackIndex.metadata_cache_key)

        metadataRequest.onsuccess = () => {
          const metadata = metadataRequest.result as OptimisticMetadataRecord | null

          // Get artwork if available
          let artwork: OptimisticArtworkRecord | null = null
          if (trackIndex.artwork_cache_key) {
            const artworkCacheStore = transaction.objectStore(OPTIMISTIC_STORES.ARTWORK_CACHE)
            const artworkRequest = artworkCacheStore.index(OPTIMISTIC_INDEXES.ARTWORK_CACHE.KEY).get(trackIndex.artwork_cache_key)

            artworkRequest.onsuccess = () => {
              artwork = artworkRequest.result as OptimisticArtworkRecord | null
              
              // Update artwork access statistics
              if (artwork) {
                artwork.last_used = now
                artwork.use_count += 1
                artworkCacheStore.put(artwork)
              }

              const duration = performance.now() - startTime
              if (metadata) {
                metadataTelemetry.recordCacheHit(key, fileName, fileSize, duration, metadata)
              }
              resolve({ metadata, artwork, trackIndex })
            }

            artworkRequest.onerror = () => {
              console.warn('Failed to get artwork from cache:', artworkRequest.error)
              const duration = performance.now() - startTime
              if (metadata) {
                metadataTelemetry.recordCacheHit(key, fileName, fileSize, duration, metadata)
              }
              resolve({ metadata, artwork: null, trackIndex })
            }
          } else {
            const duration = performance.now() - startTime
            if (metadata) {
              metadataTelemetry.recordCacheHit(key, fileName, fileSize, duration, metadata)
            }
            resolve({ metadata, artwork, trackIndex })
          }
        }

        metadataRequest.onerror = () => {
          console.warn('Failed to get metadata from cache:', metadataRequest.error)
          const duration = performance.now() - startTime
          metadataTelemetry.recordCacheMiss(fileName, fileSize)
          resolve({ metadata: null, artwork: null, trackIndex })
        }
      }

      trackIndexRequest.onerror = () => {
        const duration = performance.now() - startTime
        metadataTelemetry.recordCacheMiss(fileName, fileSize)
        reject(trackIndexRequest.error)
      }
    })
  }

  // Store optimistic metadata (fast path)
  async storeOptimisticMetadata(
    fileName: string,
    fileSize: number,
    metadata: AudioMetadata,
    arrayBuffer?: ArrayBuffer
  ): Promise<{ key: string; metadataKey: string; artworkKey?: string }> {
    const db = await this.init()
    const key = computeOptimisticKey(fileName, fileSize)
    const now = new Date()

    // Compute content fingerprint if we have the array buffer
    let contentFingerprint: string | undefined
    if (arrayBuffer) {
      contentFingerprint = await computeContentFingerprint(arrayBuffer)
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        OPTIMISTIC_STORES.TRACK_INDEX,
        OPTIMISTIC_STORES.METADATA_CACHE,
        OPTIMISTIC_STORES.ARTWORK_CACHE
      ], 'readwrite')

      // Store metadata
      const metadataCacheStore = transaction.objectStore(OPTIMISTIC_STORES.METADATA_CACHE)
      const metadataKey = `${key}_metadata`
      const metadataRecord: OptimisticMetadataRecord = {
        key: metadataKey,
        title: metadata.title || fileName.replace(/\.[^/.]+$/, ''),
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Unknown Album',
        year: metadata.year,
        genre: metadata.genre,
        duration: metadata.duration || 0,
        sample_rate: metadata.sample_rate || 0,
        channels: metadata.channels || 0,
        bit_depth: metadata.bit_depth || 0,
        bitrate: metadata.bitrate || 0,
        format: metadata.format || 'unknown',
        album_art_mime: metadata.album_art_mime,
        verified: false,
        created_at: now,
        updated_at: now
      }

      const metadataRequest = metadataCacheStore.add(metadataRecord)
      let artworkKey: string | undefined

      // Store artwork if available
      if (metadata.album_art && metadata.album_art.length > 0) {
        const artworkCacheStore = transaction.objectStore(OPTIMISTIC_STORES.ARTWORK_CACHE)
        artworkKey = `${key}_artwork`
        const artworkRecord: OptimisticArtworkRecord = {
          key: artworkKey,
          data: metadata.album_art,
          mime_type: metadata.album_art_mime || 'image/jpeg',
          size: metadata.album_art.length,
          album_artist: metadata.artist,
          created_at: now,
          last_used: now,
          use_count: 1
        }
        artworkCacheStore.add(artworkRecord)
      }

      // Store track index
      const trackIndexStore = transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX)
      const trackIndexRecord: TrackIndexRecord = {
        key,
        file_name: fileName,
        file_name_lower: fileName.toLowerCase(),
        file_size: fileSize,
        content_fingerprint: contentFingerprint,
        metadata_cache_key: metadataKey,
        artwork_cache_key: artworkKey,
        created_at: now,
        last_accessed: now,
        access_count: 1,
        verified: false
      }

      const trackIndexRequest = trackIndexStore.add(trackIndexRecord)

      transaction.oncomplete = () => {
        console.log('✅ Optimistic metadata stored successfully:', { key, metadataKey, artworkKey })
        resolve({ key, metadataKey, artworkKey })
      }

      transaction.onerror = () => {
        console.error('❌ Failed to store optimistic metadata:', transaction.error)
        reject(transaction.error)
      }
    })
  }

  // Verify and update metadata (background verification)
  async verifyAndUpdateMetadata(
    key: string,
    fileName: string,
    fileSize: number,
    verifiedMetadata: AudioMetadata,
    arrayBuffer: ArrayBuffer
  ): Promise<{ updated: boolean; collision: boolean }> {
    const db = await this.init()
    const verificationHash = await computeVerificationHash(arrayBuffer)
    const contentFingerprint = await computeContentFingerprint(arrayBuffer)
    const now = new Date()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        OPTIMISTIC_STORES.TRACK_INDEX,
        OPTIMISTIC_STORES.METADATA_CACHE,
        OPTIMISTIC_STORES.ARTWORK_CACHE
      ], 'readwrite')

      // Get existing track index
      const trackIndexStore = transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX)
      const trackIndexRequest = trackIndexStore.index(OPTIMISTIC_INDEXES.TRACK_INDEX.KEY).get(key)

      trackIndexRequest.onsuccess = () => {
        const trackIndex = trackIndexRequest.result as TrackIndexRecord | null

        if (!trackIndex) {
          // Track not found, create new entry
          this.storeOptimisticMetadata(fileName, fileSize, verifiedMetadata, arrayBuffer)
          resolve({ updated: true, collision: false })
          return
        }

        // Check for collision using content fingerprint
        const collision = trackIndex.content_fingerprint && 
                         trackIndex.content_fingerprint !== contentFingerprint

        if (collision) {
          console.warn('⚠️ Content collision detected for key:', key)
          
          // Mark old entry as superseded
          trackIndex.superseded_by = key
          trackIndexStore.put(trackIndex)

          // Create new entry with different key
          const newKey = `${key}_${Date.now()}`
          this.storeOptimisticMetadata(fileName, fileSize, verifiedMetadata, arrayBuffer)
          resolve({ updated: true, collision: true })
          return
        }

        // Update metadata with verified data
        const metadataCacheStore = transaction.objectStore(OPTIMISTIC_STORES.METADATA_CACHE)
        const metadataRequest = metadataCacheStore.index(OPTIMISTIC_INDEXES.METADATA_CACHE.KEY).get(trackIndex.metadata_cache_key)

        metadataRequest.onsuccess = () => {
          const metadata = metadataRequest.result as OptimisticMetadataRecord
          
          if (metadata) {
            // Update metadata with verified information
            metadata.title = verifiedMetadata.title || metadata.title
            metadata.artist = verifiedMetadata.artist || metadata.artist
            metadata.album = verifiedMetadata.album || metadata.album
            metadata.year = verifiedMetadata.year || metadata.year
            metadata.genre = verifiedMetadata.genre || metadata.genre
            metadata.duration = verifiedMetadata.duration || metadata.duration
            metadata.sample_rate = verifiedMetadata.sample_rate || metadata.sample_rate
            metadata.channels = verifiedMetadata.channels || metadata.channels
            metadata.bit_depth = verifiedMetadata.bit_depth || metadata.bit_depth
            metadata.bitrate = verifiedMetadata.bitrate || metadata.bitrate
            metadata.format = verifiedMetadata.format || metadata.format
            metadata.album_art_mime = verifiedMetadata.album_art_mime || metadata.album_art_mime
            metadata.verified = true
            metadata.verification_hash = verificationHash
            metadata.updated_at = now
            metadata.verified_at = now

            metadataCacheStore.put(metadata)
          }

          // Update artwork if available
          if (verifiedMetadata.album_art && verifiedMetadata.album_art.length > 0) {
            const artworkCacheStore = transaction.objectStore(OPTIMISTIC_STORES.ARTWORK_CACHE)
            const artworkKey = trackIndex.artwork_cache_key || `${key}_artwork`
            
            const artworkRecord: OptimisticArtworkRecord = {
              key: artworkKey,
              data: verifiedMetadata.album_art,
              mime_type: verifiedMetadata.album_art_mime || 'image/jpeg',
              size: verifiedMetadata.album_art.length,
              album_artist: verifiedMetadata.artist,
              created_at: now,
              last_used: now,
              use_count: 1
            }

            // Update or create artwork
            const artworkRequest = artworkCacheStore.index(OPTIMISTIC_INDEXES.ARTWORK_CACHE.KEY).get(artworkKey)
            artworkRequest.onsuccess = () => {
              if (artworkRequest.result) {
                const existing = artworkRequest.result as OptimisticArtworkRecord
                existing.data = artworkRecord.data
                existing.mime_type = artworkRecord.mime_type
                existing.size = artworkRecord.size
                existing.last_used = now
                existing.use_count += 1
                artworkCacheStore.put(existing)
              } else {
                artworkCacheStore.add(artworkRecord)
              }
            }
          }

          // Update track index
          trackIndex.content_fingerprint = contentFingerprint
          trackIndex.verified = true
          trackIndex.updated_at = now
          trackIndexStore.put(trackIndex)

          transaction.oncomplete = () => {
            console.log('✅ Metadata verification completed:', { key, collision })
            resolve({ updated: true, collision: false })
          }
        }

        metadataRequest.onerror = () => {
          reject(metadataRequest.error)
        }
      }

      trackIndexRequest.onerror = () => {
        reject(trackIndexRequest.error)
      }
    })
  }

  // Add to verification queue
  async addToVerificationQueue(key: string, priority: number = 1): Promise<void> {
    const db = await this.init()
    const now = new Date()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OPTIMISTIC_STORES.VERIFICATION_QUEUE], 'readwrite')
      const queueStore = transaction.objectStore(OPTIMISTIC_STORES.VERIFICATION_QUEUE)

      const queueRecord: VerificationQueueRecord = {
        key,
        priority,
        retry_count: 0,
        created_at: now
      }

      const request = queueStore.add(queueRecord)

      request.onsuccess = () => {
        console.log('✅ Added to verification queue:', { key, priority })
        resolve()
      }

      request.onerror = () => {
        // If key already exists, update priority
        if (request.error?.name === 'ConstraintError') {
          const updateRequest = queueStore.index(OPTIMISTIC_INDEXES.VERIFICATION_QUEUE.KEY).get(key)
          updateRequest.onsuccess = () => {
            const existing = updateRequest.result as VerificationQueueRecord
            if (existing && priority > existing.priority) {
              existing.priority = priority
              existing.updated_at = now
              queueStore.put(existing)
            }
            resolve()
          }
        } else {
          reject(request.error)
        }
      }
    })
  }

  // Get next item from verification queue
  async getNextVerificationItem(): Promise<VerificationQueueRecord | null> {
    const db = await this.init()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OPTIMISTIC_STORES.VERIFICATION_QUEUE], 'readwrite')
      const queueStore = transaction.objectStore(OPTIMISTIC_STORES.VERIFICATION_QUEUE)
      
      // Get items ordered by priority (descending) and creation date (ascending)
      const request = queueStore.index(OPTIMISTIC_INDEXES.VERIFICATION_QUEUE.PRIORITY).openCursor(null, 'prev')

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const item = cursor.value as VerificationQueueRecord
          cursor.delete() // Remove from queue
          resolve(item)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Clean up old entries (LRU eviction)
  async cleanupOldEntries(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const db = await this.init()
    const cutoffDate = new Date(Date.now() - maxAge)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        OPTIMISTIC_STORES.TRACK_INDEX,
        OPTIMISTIC_STORES.METADATA_CACHE,
        OPTIMISTIC_STORES.ARTWORK_CACHE
      ], 'readwrite')

      let deletedCount = 0

      // Clean up old track index entries
      const trackIndexStore = transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX)
      const trackIndexRequest = trackIndexStore.index(OPTIMISTIC_INDEXES.TRACK_INDEX.LAST_ACCESSED).openCursor()

      trackIndexRequest.onsuccess = () => {
        const cursor = trackIndexRequest.result
        if (cursor) {
          const record = cursor.value as TrackIndexRecord
          if (record.last_accessed < cutoffDate && record.access_count < 3) {
            cursor.delete()
            deletedCount++
          }
          cursor.continue()
        } else {
          // Clean up old artwork (keep metadata longer)
          const artworkStore = transaction.objectStore(OPTIMISTIC_STORES.ARTWORK_CACHE)
          const artworkRequest = artworkStore.index(OPTIMISTIC_INDEXES.ARTWORK_CACHE.LAST_USED).openCursor()

          artworkRequest.onsuccess = () => {
            const cursor = artworkRequest.result
            if (cursor) {
              const record = cursor.value as OptimisticArtworkRecord
              if (record.last_used < cutoffDate && record.use_count < 2) {
                cursor.delete()
                deletedCount++
              }
              cursor.continue()
            } else {
              transaction.oncomplete = () => {
                console.log(`🧹 Cleaned up ${deletedCount} old optimistic metadata entries`)
                resolve(deletedCount)
              }
            }
          }
        }
      }

      transaction.onerror = () => {
        reject(transaction.error)
      }
    })
  }

  // Get statistics
  async getStats(): Promise<{
    trackIndexCount: number
    metadataCacheCount: number
    artworkCacheCount: number
    verificationQueueCount: number
    verifiedCount: number
    unverifiedCount: number
  }> {
    const db = await this.init()

    const getCount = (storeName: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.count()

        request.onsuccess = () => {
          resolve(request.result)
        }

        request.onerror = () => {
          reject(request.error)
        }
      })
    }

    const [trackIndexCount, metadataCacheCount, artworkCacheCount, verificationQueueCount] = await Promise.all([
      getCount(OPTIMISTIC_STORES.TRACK_INDEX),
      getCount(OPTIMISTIC_STORES.METADATA_CACHE),
      getCount(OPTIMISTIC_STORES.ARTWORK_CACHE),
      getCount(OPTIMISTIC_STORES.VERIFICATION_QUEUE)
    ])

    // Get verified/unverified counts
    const getVerifiedCount = (): Promise<number> => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([OPTIMISTIC_STORES.TRACK_INDEX], 'readonly')
        const store = transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX)
        const request = store.index(OPTIMISTIC_INDEXES.TRACK_INDEX.LAST_ACCESSED).getAll()

        request.onsuccess = () => {
          const records = request.result as TrackIndexRecord[]
          const verifiedCount = records.filter(r => r.verified).length
          resolve(verifiedCount)
        }

        request.onerror = () => {
          reject(request.error)
        }
      })
    }

    const verifiedCount = await getVerifiedCount()

    return {
      trackIndexCount,
      metadataCacheCount,
      artworkCacheCount,
      verificationQueueCount,
      verifiedCount,
      unverifiedCount: trackIndexCount - verifiedCount
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    const db = await this.init()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        OPTIMISTIC_STORES.TRACK_INDEX,
        OPTIMISTIC_STORES.METADATA_CACHE,
        OPTIMISTIC_STORES.ARTWORK_CACHE,
        OPTIMISTIC_STORES.VERIFICATION_QUEUE
      ], 'readwrite')

      const stores = [
        transaction.objectStore(OPTIMISTIC_STORES.TRACK_INDEX),
        transaction.objectStore(OPTIMISTIC_STORES.METADATA_CACHE),
        transaction.objectStore(OPTIMISTIC_STORES.ARTWORK_CACHE),
        transaction.objectStore(OPTIMISTIC_STORES.VERIFICATION_QUEUE)
      ]

      stores.forEach(store => store.clear())

      transaction.oncomplete = () => {
        console.log('🗑️ All optimistic metadata cleared')
        resolve()
      }

      transaction.onerror = () => {
        reject(transaction.error)
      }
    })
  }
}

// Export singleton instance
export const optimisticMetadataStore = new OptimisticMetadataStore()
