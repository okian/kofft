import { AudioMetadata, ArtworkSource } from '@/types'
import { useUIStore } from '@/shared/stores/uiStore'

// Database configuration
const DB_NAME = 'SpectrogramMetadataDB'
const DB_VERSION = 1

// Store names
const STORES = {
  METADATA: 'metadata',
  ALBUMS: 'albums',
  ARTISTS: 'artists',
  GENRES: 'genres',
  YEARS: 'years',
  ALBUM_ART: 'album_art',
  TRACKS: 'tracks'
} as const

// Index names for efficient queries
const INDEXES = {
  METADATA: {
    HASH: 'hash',
    TITLE: 'title',
    ARTIST: 'artist',
    ALBUM: 'album',
    GENRE: 'genre',
    YEAR: 'year'
  },
  ALBUMS: {
    NAME: 'name',
    ARTIST: 'artist',
    YEAR: 'year'
  },
  ARTISTS: {
    NAME: 'name'
  },
  GENRES: {
    NAME: 'name'
  },
  YEARS: {
    YEAR: 'year'
  },
  ALBUM_ART: {
    HASH: 'hash',
    ALBUM_ARTIST: 'album_artist'
  },
  TRACKS: {
    HASH: 'hash',
    TITLE: 'title',
    ARTIST: 'artist',
    ALBUM: 'album'
  }
} as const

// Database schema interfaces
export interface MetadataRecord {
  id?: number
  hash: string
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
  album_art_hash?: string
  album_art_mime?: string
  file_size: number
  created_at: Date
  updated_at: Date
}

export interface AlbumRecord {
  id?: number
  name: string
  artist: string
  year?: number
  album_art_hash?: string
  track_count: number
  total_duration: number
  created_at: Date
  updated_at: Date
}

export interface ArtistRecord {
  id?: number
  name: string
  album_count: number
  track_count: number
  total_duration: number
  created_at: Date
  updated_at: Date
}

export interface GenreRecord {
  id?: number
  name: string
  track_count: number
  total_duration: number
  created_at: Date
  updated_at: Date
}

export interface YearRecord {
  id?: number
  year: number
  track_count: number
  total_duration: number
  created_at: Date
  updated_at: Date
}

export interface AlbumArtRecord {
  id?: number
  hash: string
  data: Uint8Array
  mime_type: string
  size: number
  album_artist?: string
  created_at: Date
  last_used: Date
  use_count: number
}

export interface TrackRecord {
  id?: number
  hash: string
  file_name: string
  metadata_id: number
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Worker message validation

/**
 * Keys permitted in metadata objects received from the worker. Defining the
 * whitelist here avoids magic strings and makes it impossible for unexpected
 * properties to silently slip through validation.
 */
export const ALLOWED_METADATA_FIELDS = [
  'title',
  'artist',
  'album',
  'year',
  'genre',
  'duration',
  'sample_rate',
  'channels',
  'bit_depth',
  'bitrate',
  'format',
  'album_art',
  'album_art_mime'
] as const

/**
 * Validate the shape of a metadata object produced by a worker.
 *
 * The function rejects any extraneous keys and performs conservative type
 * checks for known fields. The returned object contains only the whitelisted
 * properties, ensuring the rest of the codebase never observes untrusted
 * structure. Errors are thrown for any deviation so callers can fail fast.
 */
export function validateWorkerMetadata (input: unknown): AudioMetadata {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Metadata message must be a plain object')
  }

  const allowed = new Set<string>(ALLOWED_METADATA_FIELDS)
  const result: AudioMetadata = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      throw new Error(`Unexpected field: ${key}`)
    }
    switch (key) {
      case 'title':
      case 'artist':
      case 'album':
      case 'genre':
      case 'album_art_mime':
        if (typeof value !== 'undefined' && typeof value !== 'string') {
          throw new TypeError(`Invalid type for ${key}`)
        }
        ;(result as any)[key] = value
        break
      case 'format':
        if (typeof value !== 'undefined' && typeof value !== 'string') {
          throw new TypeError('Invalid type for format')
        }
        result.format = value as string | undefined
        break
      case 'year':
      case 'duration':
      case 'sample_rate':
      case 'channels':
      case 'bit_depth':
      case 'bitrate':
        if (typeof value !== 'undefined' && typeof value !== 'number') {
          throw new TypeError(`Invalid type for ${key}`)
        }
        ;(result as any)[key] = value
        break
      case 'album_art':
        if (typeof value !== 'undefined' && !(value instanceof Uint8Array)) {
          throw new TypeError('Invalid type for album_art')
        }
        result.album_art = value as Uint8Array | undefined
        break
      default:
        // We exhaustively check allowed keys; this clause is unreachable.
        break
    }
  }
  return result
}

// Utility to compute SHA-256 hash
async function computeHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Utility to compute album art hash
async function computeAlbumArtHash(artworkData: Uint8Array): Promise<string> {
  return await computeHash(artworkData.buffer)
}

class MetadataStore {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ IndexedDB initialized successfully')
        resolve(this.db!)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log('🔧 Creating IndexedDB schema...')

        // Create metadata store
        const metadataStore = db.createObjectStore(STORES.METADATA, { keyPath: 'id', autoIncrement: true })
        metadataStore.createIndex(INDEXES.METADATA.HASH, 'hash', { unique: true })
        metadataStore.createIndex(INDEXES.METADATA.TITLE, 'title', { unique: false })
        metadataStore.createIndex(INDEXES.METADATA.ARTIST, 'artist', { unique: false })
        metadataStore.createIndex(INDEXES.METADATA.ALBUM, 'album', { unique: false })
        metadataStore.createIndex(INDEXES.METADATA.GENRE, 'genre', { unique: false })
        metadataStore.createIndex(INDEXES.METADATA.YEAR, 'year', { unique: false })

        // Create albums store
        const albumsStore = db.createObjectStore(STORES.ALBUMS, { keyPath: 'id', autoIncrement: true })
        albumsStore.createIndex(INDEXES.ALBUMS.NAME, 'name', { unique: false })
        albumsStore.createIndex(INDEXES.ALBUMS.ARTIST, 'artist', { unique: false })
        albumsStore.createIndex(INDEXES.ALBUMS.YEAR, 'year', { unique: false })

        // Create artists store
        const artistsStore = db.createObjectStore(STORES.ARTISTS, { keyPath: 'id', autoIncrement: true })
        artistsStore.createIndex(INDEXES.ARTISTS.NAME, 'name', { unique: true })

        // Create genres store
        const genresStore = db.createObjectStore(STORES.GENRES, { keyPath: 'id', autoIncrement: true })
        genresStore.createIndex(INDEXES.GENRES.NAME, 'name', { unique: true })

        // Create years store
        const yearsStore = db.createObjectStore(STORES.YEARS, { keyPath: 'id', autoIncrement: true })
        yearsStore.createIndex(INDEXES.YEARS.YEAR, 'year', { unique: true })

        // Create album art store
        const albumArtStore = db.createObjectStore(STORES.ALBUM_ART, { keyPath: 'id', autoIncrement: true })
        albumArtStore.createIndex(INDEXES.ALBUM_ART.HASH, 'hash', { unique: true })
        albumArtStore.createIndex(INDEXES.ALBUM_ART.ALBUM_ARTIST, 'album_artist', { unique: false })

        // Create tracks store
        const tracksStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'id', autoIncrement: true })
        tracksStore.createIndex(INDEXES.TRACKS.HASH, 'hash', { unique: true })
        tracksStore.createIndex(INDEXES.TRACKS.TITLE, 'title', { unique: false })
        tracksStore.createIndex(INDEXES.TRACKS.ARTIST, 'artist', { unique: false })
        tracksStore.createIndex(INDEXES.TRACKS.ALBUM, 'album', { unique: false })

        console.log('✅ IndexedDB schema created successfully')
      }
    })

    return this.initPromise
  }

  // Store metadata and related entities
  async storeMetadata(
    file: File,
    metadata: AudioMetadata,
    arrayBuffer: ArrayBuffer
  ): Promise<{ metadataId: number; albumArtId?: number }> {
    let validated: AudioMetadata
    try {
      // Validate and sanitise the worker-supplied metadata before touching the
      // database or allocating hashes. This ensures malformed messages fail fast
      // and users receive immediate feedback via the UI store.
      validated = validateWorkerMetadata(metadata)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid metadata'
      useUIStore.getState().setError(message)
      throw err
    }

    // From this point forward we can safely rely on the metadata shape.
    metadata = validated

    const db = await this.init()
    const hash = await computeHash(arrayBuffer)
    const now = new Date()

    // Pre-compute album art hash if available
    let albumArtHash: string | undefined
    if (metadata.album_art && metadata.album_art.length > 0) {
      albumArtHash = await computeAlbumArtHash(metadata.album_art)
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        STORES.METADATA,
        STORES.ALBUMS,
        STORES.ARTISTS,
        STORES.GENRES,
        STORES.YEARS,
        STORES.ALBUM_ART,
        STORES.TRACKS
      ], 'readwrite')

      let albumArtId: number | undefined

      // Store album art first if available
      if (metadata.album_art && metadata.album_art.length > 0 && albumArtHash) {
        const albumArtStore = transaction.objectStore(STORES.ALBUM_ART)
        
        // Check if album art already exists
        const existingArtRequest = albumArtStore.index(INDEXES.ALBUM_ART.HASH).get(albumArtHash)
        
        existingArtRequest.onsuccess = () => {
          if (existingArtRequest.result) {
            // Update use count and last used
            const existing = existingArtRequest.result as AlbumArtRecord
            existing.use_count += 1
            existing.last_used = now
            albumArtStore.put(existing)
            albumArtId = existing.id
          } else {
            // Store new album art
            const albumArtRecord: AlbumArtRecord = {
              hash: albumArtHash!,
              data: metadata.album_art,
              mime_type: metadata.album_art_mime || 'image/jpeg',
              size: metadata.album_art.length,
              album_artist: metadata.artist,
              created_at: now,
              last_used: now,
              use_count: 1
            }
            const addRequest = albumArtStore.add(albumArtRecord)
            addRequest.onsuccess = () => {
              albumArtId = addRequest.result as number
            }
          }
        }
      }

      // Store metadata
      const metadataStore = transaction.objectStore(STORES.METADATA)
      const metadataRecord: MetadataRecord = {
        hash,
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
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
        album_art_hash: albumArtHash,
        album_art_mime: metadata.album_art_mime,
        file_size: file.size,
        created_at: now,
        updated_at: now
      }

      const metadataRequest = metadataStore.add(metadataRecord)
      let metadataId: number

      metadataRequest.onsuccess = () => {
        metadataId = metadataRequest.result as number

        // Store track record
        const tracksStore = transaction.objectStore(STORES.TRACKS)
        const trackRecord: TrackRecord = {
          hash,
          file_name: file.name,
          metadata_id: metadataId,
          created_at: now,
          updated_at: now
        }
        tracksStore.add(trackRecord)

        // Update or create album record
        this.updateAlbumRecord(transaction, metadata, albumArtId)

        // Update or create artist record
        this.updateArtistRecord(transaction, metadata)

        // Update or create genre record
        if (metadata.genre) {
          this.updateGenreRecord(transaction, metadata.genre)
        }

        // Update or create year record
        if (metadata.year) {
          this.updateYearRecord(transaction, metadata.year)
        }

        transaction.oncomplete = () => {
          console.log('✅ Metadata stored successfully:', { metadataId, albumArtId })
          resolve({ metadataId, albumArtId })
        }

        transaction.onerror = () => {
          console.error('❌ Failed to store metadata:', transaction.error)
          const message = transaction.error ? String(transaction.error) : 'Failed to store metadata'
          useUIStore.getState().setError(message)
          reject(transaction.error)
        }
      }
    })
  }

  private async updateAlbumRecord(
    transaction: IDBTransaction,
    metadata: AudioMetadata,
    albumArtId?: number
  ) {
    const albumsStore = transaction.objectStore(STORES.ALBUMS)
    const albumKey = `${metadata.artist || 'Unknown Artist'}-${metadata.album || 'Unknown Album'}`
    
    // Check if album exists
    const existingRequest = albumsStore.index(INDEXES.ALBUMS.NAME).get(metadata.album || 'Unknown Album')
    
    existingRequest.onsuccess = () => {
      const now = new Date()
      
      if (existingRequest.result) {
        // Update existing album
        const album = existingRequest.result as AlbumRecord
        album.track_count += 1
        album.total_duration += metadata.duration || 0
        album.updated_at = now
        if (albumArtId && !album.album_art_hash) {
          album.album_art_hash = albumArtId.toString()
        }
        albumsStore.put(album)
      } else {
        // Create new album
        const albumRecord: AlbumRecord = {
          name: metadata.album || 'Unknown Album',
          artist: metadata.artist || 'Unknown Artist',
          year: metadata.year,
          album_art_hash: albumArtId?.toString(),
          track_count: 1,
          total_duration: metadata.duration || 0,
          created_at: now,
          updated_at: now
        }
        albumsStore.add(albumRecord)
      }
    }
  }

  private async updateArtistRecord(transaction: IDBTransaction, metadata: AudioMetadata) {
    const artistsStore = transaction.objectStore(STORES.ARTISTS)
    const artistName = metadata.artist || 'Unknown Artist'
    
    const existingRequest = artistsStore.index(INDEXES.ARTISTS.NAME).get(artistName)
    
    existingRequest.onsuccess = () => {
      const now = new Date()
      
      if (existingRequest.result) {
        // Update existing artist
        const artist = existingRequest.result as ArtistRecord
        artist.track_count += 1
        artist.total_duration += metadata.duration || 0
        artist.updated_at = now
        artistsStore.put(artist)
      } else {
        // Create new artist
        const artistRecord: ArtistRecord = {
          name: artistName,
          album_count: 1, // Will be updated by album logic
          track_count: 1,
          total_duration: metadata.duration || 0,
          created_at: now,
          updated_at: now
        }
        artistsStore.add(artistRecord)
      }
    }
  }

  private async updateGenreRecord(transaction: IDBTransaction, genre: string) {
    const genresStore = transaction.objectStore(STORES.GENRES)
    
    const existingRequest = genresStore.index(INDEXES.GENRES.NAME).get(genre)
    
    existingRequest.onsuccess = () => {
      const now = new Date()
      
      if (existingRequest.result) {
        // Update existing genre
        const genreRecord = existingRequest.result as GenreRecord
        genreRecord.track_count += 1
        genreRecord.updated_at = now
        genresStore.put(genreRecord)
      } else {
        // Create new genre
        const newGenreRecord: GenreRecord = {
          name: genre,
          track_count: 1,
          total_duration: 0, // Will be updated by metadata logic
          created_at: now,
          updated_at: now
        }
        genresStore.add(newGenreRecord)
      }
    }
  }

  private async updateYearRecord(transaction: IDBTransaction, year: number) {
    const yearsStore = transaction.objectStore(STORES.YEARS)
    
    const existingRequest = yearsStore.index(INDEXES.YEARS.YEAR).get(year)
    
    existingRequest.onsuccess = () => {
      const now = new Date()
      
      if (existingRequest.result) {
        // Update existing year
        const yearRecord = existingRequest.result as YearRecord
        yearRecord.track_count += 1
        yearRecord.updated_at = now
        yearsStore.put(yearRecord)
      } else {
        // Create new year
        const newYearRecord: YearRecord = {
          year,
          track_count: 1,
          total_duration: 0, // Will be updated by metadata logic
          created_at: now,
          updated_at: now
        }
        yearsStore.add(newYearRecord)
      }
    }
  }

  // Retrieve metadata by file hash
  async getMetadata(hash: string): Promise<MetadataRecord | null> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.METADATA], 'readonly')
      const store = transaction.objectStore(STORES.METADATA)
      const request = store.index(INDEXES.METADATA.HASH).get(hash)
      
      request.onsuccess = () => {
        resolve(request.result || null)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Retrieve album art by hash
  async getAlbumArt(hash: string): Promise<AlbumArtRecord | null> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ALBUM_ART], 'readonly')
      const store = transaction.objectStore(STORES.ALBUM_ART)
      const request = store.index(INDEXES.ALBUM_ART.HASH).get(hash)
      
      request.onsuccess = () => {
        resolve(request.result || null)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Get all albums
  async getAlbums(): Promise<AlbumRecord[]> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ALBUMS], 'readonly')
      const store = transaction.objectStore(STORES.ALBUMS)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve(request.result || [])
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Get all artists
  async getArtists(): Promise<ArtistRecord[]> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARTISTS], 'readonly')
      const store = transaction.objectStore(STORES.ARTISTS)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve(request.result || [])
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Get all genres
  async getGenres(): Promise<GenreRecord[]> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.GENRES], 'readonly')
      const store = transaction.objectStore(STORES.GENRES)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve(request.result || [])
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Get all years
  async getYears(): Promise<YearRecord[]> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.YEARS], 'readonly')
      const store = transaction.objectStore(STORES.YEARS)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve(request.result || [])
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Search metadata
  async searchMetadata(query: string): Promise<MetadataRecord[]> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.METADATA], 'readonly')
      const store = transaction.objectStore(STORES.METADATA)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const results = request.result || []
        const searchTerm = query.toLowerCase()
        
        const filtered = results.filter(record => 
          record.title.toLowerCase().includes(searchTerm) ||
          record.artist.toLowerCase().includes(searchTerm) ||
          record.album.toLowerCase().includes(searchTerm) ||
          (record.genre && record.genre.toLowerCase().includes(searchTerm))
        )
        
        resolve(filtered)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Clean up unused album art (older than 30 days and used less than 2 times)
  async cleanupUnusedAlbumArt(): Promise<number> {
    const db = await this.init()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ALBUM_ART], 'readwrite')
      const store = transaction.objectStore(STORES.ALBUM_ART)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const records = request.result || []
        let deletedCount = 0
        
        records.forEach(record => {
          if (record.last_used < thirtyDaysAgo && record.use_count < 2) {
            store.delete(record.id)
            deletedCount++
          }
        })
        
        transaction.oncomplete = () => {
          console.log(`🧹 Cleaned up ${deletedCount} unused album art records`)
          resolve(deletedCount)
        }
        
        transaction.onerror = () => {
          reject(transaction.error)
        }
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // Get database statistics
  async getStats(): Promise<{
    metadataCount: number
    albumCount: number
    artistCount: number
    genreCount: number
    yearCount: number
    albumArtCount: number
    trackCount: number
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
    
    const [metadataCount, albumCount, artistCount, genreCount, yearCount, albumArtCount, trackCount] = await Promise.all([
      getCount(STORES.METADATA),
      getCount(STORES.ALBUMS),
      getCount(STORES.ARTISTS),
      getCount(STORES.GENRES),
      getCount(STORES.YEARS),
      getCount(STORES.ALBUM_ART),
      getCount(STORES.TRACKS)
    ])
    
    return {
      metadataCount,
      albumCount,
      artistCount,
      genreCount,
      yearCount,
      albumArtCount,
      trackCount
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    const db = await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        STORES.METADATA,
        STORES.ALBUMS,
        STORES.ARTISTS,
        STORES.GENRES,
        STORES.YEARS,
        STORES.ALBUM_ART,
        STORES.TRACKS
      ], 'readwrite')
      
      const stores = [
        transaction.objectStore(STORES.METADATA),
        transaction.objectStore(STORES.ALBUMS),
        transaction.objectStore(STORES.ARTISTS),
        transaction.objectStore(STORES.GENRES),
        transaction.objectStore(STORES.YEARS),
        transaction.objectStore(STORES.ALBUM_ART),
        transaction.objectStore(STORES.TRACKS)
      ]
      
      stores.forEach(store => store.clear())
      
      transaction.oncomplete = () => {
        console.log('🗑️ All metadata cleared')
        resolve()
      }
      
      transaction.onerror = () => {
        reject(transaction.error)
      }
    })
  }
}

// Export singleton instance
export const metadataStore = new MetadataStore()
