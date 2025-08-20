// Extensive usage statistics tracking for audio playback
// This module is intentionally defensive and paranoid: all operations
// validate inputs and fail fast. All magic numbers are replaced with
// well named constants so behaviour is explicit and configurable.

// The statistics are persisted to IndexedDB when available. During tests
// or in environments without IndexedDB support we fall back to an
// in-memory map. The API surface mirrors the real implementation so the
// rest of the app can remain agnostic of the storage backend.

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface TrackMetadata {
  id: string; // Unique identifier for the track (hash, url, etc.)
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
}

export interface TrackStats {
  id: string;
  playCount: number;
  totalDuration: number; // seconds
  lastPlayed: number; // epoch ms
  // The following properties are stored redundantly to make per-artist / per-genre
  // aggregations fast without touching other databases. Keeping them here also
  // allows us to compute unique counts without joining.
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
}

export interface UsageStatsSummary {
  // Totals across all tracks
  totalSongs: number;
  totalArtists: number;
  totalAlbums: number;
  totalGenres: number;
  totalPlayTime: number; // seconds
  totalPlays: number; // number of completed plays
  // Raw track stats for tables / further aggregation
  tracks: TrackStats[];
}

// ---------------------------------------------------------------------
// Constants – tunable but never inline
// ---------------------------------------------------------------------

// Database configuration
const DB_NAME = "SpectrogramUsageDB";
const DB_VERSION = 1;
const STORE_NAME = "track_stats";

// Play count threshold: a track only counts as "played" after this many
// seconds have elapsed in the current session. The default comes from the
// product requirement but can be overridden by configure().
const DEFAULT_PLAY_THRESHOLD_SECONDS = 30;

// Internal flush interval. We batch writes so we do not thrash IndexedDB.
const FLUSH_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------

function getIndexedDB(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// UsageStats class
// ---------------------------------------------------------------------

class UsageStats {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryStore: Map<string, TrackStats> = new Map();

  // Tracks currently in-progress playback sessions. Each entry holds the
  // accumulated playback duration in seconds and whether the play count has
  // already been incremented for the session.
  private activeSessions: Map<string, { played: number; counted: boolean }> =
    new Map();

  private playThreshold = DEFAULT_PLAY_THRESHOLD_SECONDS;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWrites: Set<string> = new Set();

  configure({ playThresholdSeconds }: { playThresholdSeconds?: number }): void {
    if (
      playThresholdSeconds !== undefined &&
      Number.isFinite(playThresholdSeconds) &&
      playThresholdSeconds > 0
    ) {
      this.playThreshold = playThresholdSeconds;
    }
  }

  // -------------------------------------------------------------------
  // IndexedDB management
  // -------------------------------------------------------------------

  private async openDB(): Promise<IDBDatabase | null> {
    if (!getIndexedDB()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = getIndexedDB()!.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("artist", "artist", { unique: false });
        store.createIndex("album", "album", { unique: false });
        store.createIndex("genre", "genre", { unique: false });
      };

      request.onsuccess = () => resolve(request.result);
    });

    return this.dbPromise;
  }

  private async getStore(
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore | null> {
    const db = await this.openDB();
    if (!db) return null;
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  private async readAll(): Promise<TrackStats[]> {
    const store = await this.getStore("readonly");
    if (!store) {
      return Array.from(this.memoryStore.values());
    }
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as TrackStats[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async read(id: string): Promise<TrackStats | undefined> {
    if (!id) return undefined;
    const store = await this.getStore("readonly");
    if (!store) {
      return this.memoryStore.get(id);
    }
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () =>
        resolve(request.result as TrackStats | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  private async write(stat: TrackStats): Promise<void> {
    const store = await this.getStore("readwrite");
    if (!store) {
      this.memoryStore.set(stat.id, stat);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const request = store.put(stat);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(async () => {
      const ids = Array.from(this.pendingWrites);
      this.pendingWrites.clear();
      this.flushTimer = null;
      for (const id of ids) {
        const stat = await this.read(id);
        if (stat) await this.write(stat);
      }
    }, FLUSH_INTERVAL_MS);
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  async recordPlayStart(meta: TrackMetadata): Promise<void> {
    if (!meta || !meta.id) return;
    if (this.activeSessions.has(meta.id)) return; // Ignore double starts
    this.activeSessions.set(meta.id, { played: 0, counted: false });
    // Ensure we have a record for this track so totals are correct even if the
    // track never passes the play threshold.
    const existing = await this.read(meta.id);
    if (!existing) {
      const stat: TrackStats = {
        id: meta.id,
        playCount: 0,
        totalDuration: 0,
        lastPlayed: 0,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        genre: meta.genre,
      };
      await this.write(stat);
    }
  }

  async recordPlayProgress(id: string, seconds: number): Promise<void> {
    const session = this.activeSessions.get(id);
    if (!session) return; // Unknown session
    if (!Number.isFinite(seconds) || seconds <= 0) return; // Invalid input

    session.played += seconds;

    if (!session.counted && session.played >= this.playThreshold) {
      // We only count the play once per session
      const stat = (await this.read(id))!;
      stat.playCount += 1;
      stat.lastPlayed = Date.now();
      this.pendingWrites.add(id);
      session.counted = true;
      this.scheduleFlush();
    }
  }

  async recordPlayEnd(id: string): Promise<void> {
    const session = this.activeSessions.get(id);
    if (!session) return;
    const stat = (await this.read(id))!;
    stat.totalDuration += session.played;
    stat.lastPlayed = Date.now();
    this.pendingWrites.add(id);
    this.scheduleFlush();
    this.activeSessions.delete(id);
  }

  async getStats(): Promise<UsageStatsSummary> {
    const tracks = await this.readAll();
    // Compute aggregate totals. We intentionally avoid allocating large
    // intermediate structures to keep memory usage small even for large
    // libraries.
    let totalPlayTime = 0;
    let totalPlays = 0;
    const artists = new Set<string>();
    const albums = new Set<string>();
    const genres = new Set<string>();

    for (const t of tracks) {
      totalPlayTime += t.totalDuration;
      totalPlays += t.playCount;
      if (t.artist) artists.add(t.artist);
      if (t.album) albums.add(t.album);
      if (t.genre) genres.add(t.genre);
    }

    return {
      totalSongs: tracks.length,
      totalArtists: artists.size,
      totalAlbums: albums.size,
      totalGenres: genres.size,
      totalPlayTime,
      totalPlays,
      tracks,
    };
  }

  async resetStats(): Promise<void> {
    this.activeSessions.clear();
    this.pendingWrites.clear();
    const store = await this.getStore("readwrite");
    if (!store) {
      this.memoryStore.clear();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async flushDatabase(): Promise<void> {
    const db = await this.openDB();
    if (db) {
      db.close();
      await new Promise<void>((resolve) => {
        const req = getIndexedDB()!.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve(); // Ignore errors, nothing we can do
      });
    }
    this.memoryStore.clear();
    this.activeSessions.clear();
    this.pendingWrites.clear();
    this.dbPromise = null;
  }
}

// Singleton instance
export const usageStats = new UsageStats();

// Re-export public methods for convenience and to keep a stable API surface.
export const recordPlayStart = usageStats.recordPlayStart.bind(usageStats);
export const recordPlayProgress =
  usageStats.recordPlayProgress.bind(usageStats);
export const recordPlayEnd = usageStats.recordPlayEnd.bind(usageStats);
export const getStats = usageStats.getStats.bind(usageStats);
export const resetStats = usageStats.resetStats.bind(usageStats);
export const flushDatabase = usageStats.flushDatabase.bind(usageStats);
export const configureUsageStats = usageStats.configure.bind(usageStats);
