# Optimistic Metadata System

## Overview

The Optimistic Metadata System provides fast, instant metadata loading for audio tracks by implementing a sophisticated caching and verification strategy. When a track is added to the playlist, the system immediately shows previously known metadata and artwork if available, then verifies and updates the information in the background.

## Key Features

### 🚀 Instant UI Response
- **≤50ms cache hits**: Previously seen tracks load instantly
- **Optimistic rendering**: Show cached metadata immediately, verify later
- **Progressive enhancement**: Update UI as verification completes

### 🗄️ Intelligent Caching
- **Stable keys**: `hash(fileName.toLowerCase() + ":" + fileSize)`
- **Case-insensitive lookup**: Preserves original filename for display
- **Content fingerprinting**: Detects file collisions using lightweight hashing
- **LRU eviction**: Automatic cleanup of old entries

### 🔄 Background Verification
- **Non-blocking verification**: Full metadata extraction in background
- **Priority queue**: Currently playing tracks verified first
- **Retry logic**: Exponential backoff for failed verifications
- **Collision detection**: Handles same-size files with different content

### 📊 Comprehensive Telemetry
- **Performance monitoring**: Cache hit rates, verification times
- **Collision tracking**: Monitor data integrity issues
- **Real-time insights**: Live statistics and recommendations
- **Export capabilities**: Debug data for analysis

## Architecture

### Core Components

1. **OptimisticMetadataStore** (`src/utils/optimisticMetadataStore.ts`)
   - IndexedDB-based caching system
   - Track index, metadata cache, artwork cache
   - Verification queue management

2. **MetadataVerificationWorker** (`src/utils/metadataVerificationWorker.ts`)
   - Background verification processing
   - Priority-based task queue
   - Retry logic and error handling

3. **MetadataTelemetry** (`src/utils/metadataTelemetry.ts`)
   - Performance monitoring and statistics
   - Event tracking and analysis
   - Performance insights and recommendations

4. **OptimisticMetadataPanel** (`src/components/layout/OptimisticMetadataPanel.tsx`)
   - Management interface for the system
   - Real-time statistics display
   - Cache management controls

### Data Flow

```
1. User adds audio file
   ↓
2. Compute optimistic key (fileName + fileSize)
   ↓
3. Check optimistic cache
   ├─ Cache Hit: Display immediately + queue verification
   └─ Cache Miss: Full extraction + store in cache
   ↓
4. Background verification updates cache
   ↓
5. UI updates with verified data (if different)
```

## Database Schema

### Track Index Store
```typescript
interface TrackIndexRecord {
  key: string                    // hash(fileName.toLowerCase() + ":" + fileSize)
  file_name: string             // Original filename (preserved)
  file_name_lower: string       // Lowercase for lookup
  file_size: number
  content_fingerprint?: string  // Lightweight content hash
  metadata_cache_key: string
  artwork_cache_key?: string
  created_at: Date
  last_accessed: Date
  access_count: number
  verified: boolean
  superseded_by?: string        // Collision handling
}
```

### Metadata Cache Store
```typescript
interface OptimisticMetadataRecord {
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
  verification_hash?: string    // Full content hash when verified
  created_at: Date
  updated_at: Date
  verified_at?: Date
}
```

### Artwork Cache Store
```typescript
interface OptimisticArtworkRecord {
  key: string
  data: Uint8Array
  mime_type: string
  size: number
  album_artist?: string
  created_at: Date
  last_used: Date
  use_count: number
}
```

## Usage

### Basic Integration

The system is automatically integrated into the `useAudioFile` hook:

```typescript
import { useAudioFile } from '@/hooks/useAudioFile'

const { loadAudioFile } = useAudioFile()

// Optimistic loading happens automatically
const track = await loadAudioFile(file)
```

### Manual Cache Management

```typescript
import { optimisticMetadataStore } from '@/utils/optimisticMetadataStore'

// Get cached metadata
const result = await optimisticMetadataStore.getOptimisticMetadata(fileName, fileSize)

// Store metadata
await optimisticMetadataStore.storeOptimisticMetadata(fileName, fileSize, metadata, arrayBuffer)

// Clear cache
await optimisticMetadataStore.clearAll()

// Get statistics
const stats = await optimisticMetadataStore.getStats()
```

### Verification Worker Control

```typescript
import { metadataVerificationWorker } from '@/utils/metadataVerificationWorker'

// Add verification task
await metadataVerificationWorker.addVerificationTask(fileName, fileSize, arrayBuffer, priority)

// Get worker status
const status = metadataVerificationWorker.getQueueStatus()

// Control worker
metadataVerificationWorker.pause()
metadataVerificationWorker.resume()
metadataVerificationWorker.stop()
```

### Telemetry and Monitoring

```typescript
import { metadataTelemetry } from '@/utils/metadataTelemetry'

// Get statistics
const stats = metadataTelemetry.getStats()

// Get performance insights
const insights = metadataTelemetry.getPerformanceInsights()

// Export data for analysis
const data = metadataTelemetry.exportData()

// Log summary to console
metadataTelemetry.logSummary()
```

## Performance Characteristics

### Cache Performance
- **Cache Hit Time**: <50ms (target)
- **Cache Miss Time**: Full extraction time + storage overhead
- **Storage Overhead**: ~2-5KB per track (metadata + artwork)

### Verification Performance
- **Verification Time**: 1-5 seconds per track (depends on file size)
- **Concurrent Processing**: 3 tracks simultaneously
- **Queue Management**: Priority-based with exponential backoff

### Memory Usage
- **In-Memory Queue**: ~100 tasks maximum
- **IndexedDB Storage**: Limited by browser quota
- **Automatic Cleanup**: LRU eviction for old entries

## Configuration

### Verification Worker Settings
```typescript
const VERIFICATION_CONFIG = {
  BATCH_SIZE: 3,                    // Process 3 items at a time
  DELAY_BETWEEN_BATCHES: 1000,      // 1 second between batches
  MAX_RETRIES: 3,                   // Maximum retry attempts
  RETRY_DELAY: 5000,                // 5 seconds between retries
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  MAX_QUEUE_SIZE: 100               // Maximum items in queue
}
```

### Telemetry Settings
```typescript
const TELEMETRY_CONFIG = {
  MAX_EVENTS: 1000,                 // Keep last 1000 events
  AUTO_LOG_INTERVAL: 5 * 60 * 1000  // Log every 5 minutes in dev
}
```

## Monitoring and Debugging

### Performance Metrics
- **Cache Hit Rate**: Target >80%
- **Verification Success Rate**: Target >95%
- **Average Cache Hit Time**: Target <50ms
- **Average Verification Time**: Target <5s

### Common Issues

1. **Low Cache Hit Rate**
   - Check if files are being renamed frequently
   - Verify file size consistency
   - Consider increasing cache retention

2. **High Verification Failure Rate**
   - Check WASM module availability
   - Verify file format support
   - Monitor for corrupted files

3. **Memory Issues**
   - Reduce MAX_QUEUE_SIZE
   - Increase cleanup frequency
   - Monitor IndexedDB usage

### Debug Tools

1. **OptimisticMetadataPanel**: Real-time statistics and controls
2. **Console Logging**: Detailed operation logs
3. **Telemetry Export**: JSON data for analysis
4. **Performance Insights**: Automated recommendations

## Migration and Compatibility

### Legacy Metadata Store
The system maintains compatibility with the existing `metadataStore`:
- Falls back to legacy store if optimistic cache fails
- Stores in both systems for backward compatibility
- Gradual migration as optimistic cache builds up

### Schema Versioning
- Database versioning for schema updates
- Automatic migration between versions
- Backward compatibility maintained

## Security Considerations

### Data Privacy
- All data stored locally in IndexedDB
- No external transmission of file content
- Content fingerprints are local only

### Integrity
- Content fingerprinting prevents cache poisoning
- Verification ensures data accuracy
- Collision detection maintains data integrity

## Future Enhancements

### Planned Features
1. **Distributed Caching**: Share cache across browser tabs
2. **Cloud Sync**: Backup cache to user account
3. **Advanced Fingerprinting**: More robust collision detection
4. **Predictive Loading**: Pre-cache based on user patterns

### Performance Optimizations
1. **Compression**: Reduce storage overhead
2. **Parallel Processing**: Increase verification throughput
3. **Smart Eviction**: Better LRU algorithms
4. **Memory Pooling**: Reduce GC pressure

## Troubleshooting

### Common Problems

**Q: Cache hits are slow (>50ms)**
A: Check IndexedDB performance, consider database optimization

**Q: Verification queue is backing up**
A: Reduce BATCH_SIZE, increase DELAY_BETWEEN_BATCHES

**Q: Memory usage is high**
A: Reduce MAX_QUEUE_SIZE, increase cleanup frequency

**Q: Collisions detected frequently**
A: Check for file corruption, verify fingerprinting algorithm

### Debug Commands

```javascript
// In browser console
window.metadataTelemetry.logSummary()
window.optimisticMetadataStore.getStats().then(console.log)
window.metadataVerificationWorker.getQueueStatus()
```

### Log Analysis

Look for these log patterns:
- `⚡ [OPTIMISTIC] Cache hit in Xms` - Successful cache hits
- `🔍 [METADATA] No optimistic cache hit` - Cache misses
- `⚠️ Content collision detected` - Data integrity issues
- `✅ Metadata verification completed` - Successful verifications
- `❌ Metadata verification failed` - Verification failures

## Contributing

When contributing to the optimistic metadata system:

1. **Performance First**: All changes must maintain <50ms cache hit target
2. **Backward Compatibility**: Maintain compatibility with legacy systems
3. **Telemetry**: Add appropriate metrics for new features
4. **Testing**: Include performance and integrity tests
5. **Documentation**: Update this README for significant changes
