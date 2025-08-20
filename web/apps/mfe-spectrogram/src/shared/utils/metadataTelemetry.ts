// Telemetry and monitoring for optimistic metadata system

export interface MetadataTelemetryEvent {
  type: 'cache_hit' | 'cache_miss' | 'verification_start' | 'verification_complete' | 'verification_failed' | 'collision_detected'
  timestamp: number
  duration?: number
  key?: string
  fileName?: string
  fileSize?: number
  error?: string
  metadata?: {
    title?: string
    artist?: string
    album?: string
    verified: boolean
  }
}

export interface MetadataTelemetryStats {
  totalEvents: number
  cacheHits: number
  cacheMisses: number
  verificationsStarted: number
  verificationsCompleted: number
  verificationsFailed: number
  collisionsDetected: number
  averageCacheHitTime: number
  averageVerificationTime: number
  cacheHitRate: number
  verificationSuccessRate: number
  lastUpdated: number
}

class MetadataTelemetry {
  private events: MetadataTelemetryEvent[] = []
  private maxEvents = 1000 // Keep last 1000 events
  private stats: MetadataTelemetryStats = {
    totalEvents: 0,
    cacheHits: 0,
    cacheMisses: 0,
    verificationsStarted: 0,
    verificationsCompleted: 0,
    verificationsFailed: 0,
    collisionsDetected: 0,
    averageCacheHitTime: 0,
    averageVerificationTime: 0,
    cacheHitRate: 0,
    verificationSuccessRate: 0,
    lastUpdated: Date.now()
  }

  // Record a telemetry event
  recordEvent(event: Omit<MetadataTelemetryEvent, 'timestamp'>): void {
    const fullEvent: MetadataTelemetryEvent = {
      ...event,
      timestamp: Date.now()
    }

    this.events.push(fullEvent)
    
    // Keep only the last maxEvents
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    this.updateStats()
  }

  // Record cache hit
  recordCacheHit(key: string, fileName: string, fileSize: number, duration: number, metadata: any): void {
    this.recordEvent({
      type: 'cache_hit',
      duration,
      key,
      fileName,
      fileSize,
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        verified: metadata.verified || false
      }
    })
  }

  // Record cache miss
  recordCacheMiss(fileName: string, fileSize: number): void {
    this.recordEvent({
      type: 'cache_miss',
      fileName,
      fileSize
    })
  }

  // Record verification start
  recordVerificationStart(key: string, fileName: string, fileSize: number): void {
    this.recordEvent({
      type: 'verification_start',
      key,
      fileName,
      fileSize
    })
  }

  // Record verification completion
  recordVerificationComplete(key: string, fileName: string, fileSize: number, duration: number, metadata: any): void {
    this.recordEvent({
      type: 'verification_complete',
      duration,
      key,
      fileName,
      fileSize,
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        verified: true
      }
    })
  }

  // Record verification failure
  recordVerificationFailed(key: string, fileName: string, fileSize: number, error: string): void {
    this.recordEvent({
      type: 'verification_failed',
      key,
      fileName,
      fileSize,
      error
    })
  }

  // Record collision detection
  recordCollisionDetected(key: string, fileName: string, fileSize: number): void {
    this.recordEvent({
      type: 'collision_detected',
      key,
      fileName,
      fileSize
    })
  }

  // Update statistics
  private updateStats(): void {
    const cacheHitEvents = this.events.filter(e => e.type === 'cache_hit')
    const cacheMissEvents = this.events.filter(e => e.type === 'cache_miss')
    const verificationStartEvents = this.events.filter(e => e.type === 'verification_start')
    const verificationCompleteEvents = this.events.filter(e => e.type === 'verification_complete')
    const verificationFailedEvents = this.events.filter(e => e.type === 'verification_failed')
    const collisionEvents = this.events.filter(e => e.type === 'collision_detected')

    const totalCacheEvents = cacheHitEvents.length + cacheMissEvents.length
    const totalVerifications = verificationCompleteEvents.length + verificationFailedEvents.length

    this.stats = {
      totalEvents: this.events.length,
      cacheHits: cacheHitEvents.length,
      cacheMisses: cacheMissEvents.length,
      verificationsStarted: verificationStartEvents.length,
      verificationsCompleted: verificationCompleteEvents.length,
      verificationsFailed: verificationFailedEvents.length,
      collisionsDetected: collisionEvents.length,
      averageCacheHitTime: cacheHitEvents.length > 0 
        ? cacheHitEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / cacheHitEvents.length 
        : 0,
      averageVerificationTime: verificationCompleteEvents.length > 0
        ? verificationCompleteEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / verificationCompleteEvents.length
        : 0,
      cacheHitRate: totalCacheEvents > 0 ? cacheHitEvents.length / totalCacheEvents : 0,
      verificationSuccessRate: totalVerifications > 0 ? verificationCompleteEvents.length / totalVerifications : 0,
      lastUpdated: Date.now()
    }
  }

  // Get current statistics
  getStats(): MetadataTelemetryStats {
    return { ...this.stats }
  }

  // Get recent events (last N events)
  getRecentEvents(count: number = 50): MetadataTelemetryEvent[] {
    return this.events.slice(-count)
  }

  // Get events by type
  getEventsByType(type: MetadataTelemetryEvent['type']): MetadataTelemetryEvent[] {
    return this.events.filter(e => e.type === type)
  }

  // Get events for a specific key
  getEventsForKey(key: string): MetadataTelemetryEvent[] {
    return this.events.filter(e => e.key === key)
  }

  // Get performance insights
  getPerformanceInsights(): {
    cachePerformance: string
    verificationPerformance: string
    recommendations: string[]
  } {
    const insights = {
      cachePerformance: '',
      verificationPerformance: '',
      recommendations: [] as string[]
    }

    // Cache performance analysis
    if (this.stats.cacheHitRate > 0.8) {
      insights.cachePerformance = 'Excellent cache hit rate'
    } else if (this.stats.cacheHitRate > 0.6) {
      insights.cachePerformance = 'Good cache hit rate'
    } else if (this.stats.cacheHitRate > 0.4) {
      insights.cachePerformance = 'Moderate cache hit rate'
    } else {
      insights.cachePerformance = 'Low cache hit rate - consider tuning'
    }

    // Verification performance analysis
    if (this.stats.verificationSuccessRate > 0.95) {
      insights.verificationPerformance = 'Excellent verification success rate'
    } else if (this.stats.verificationSuccessRate > 0.9) {
      insights.verificationPerformance = 'Good verification success rate'
    } else if (this.stats.verificationSuccessRate > 0.8) {
      insights.verificationPerformance = 'Moderate verification success rate'
    } else {
      insights.verificationPerformance = 'Low verification success rate - investigate failures'
    }

    // Recommendations
    if (this.stats.cacheHitRate < 0.5) {
      insights.recommendations.push('Consider increasing cache retention period')
    }
    if (this.stats.verificationSuccessRate < 0.9) {
      insights.recommendations.push('Investigate verification failures')
    }
    if (this.stats.collisionsDetected > 0) {
      insights.recommendations.push('Content collisions detected - monitor for data integrity')
    }
    if (this.stats.averageCacheHitTime > 100) {
      insights.recommendations.push('Cache hit time is high - optimize database queries')
    }
    if (this.stats.averageVerificationTime > 5000) {
      insights.recommendations.push('Verification time is high - consider parallel processing')
    }

    return insights
  }

  // Export data for debugging
  exportData(): {
    stats: MetadataTelemetryStats
    events: MetadataTelemetryEvent[]
    insights: ReturnType<typeof this.getPerformanceInsights>
  } {
    return {
      stats: this.getStats(),
      events: this.getRecentEvents(100),
      insights: this.getPerformanceInsights()
    }
  }

  // Clear all data
  clear(): void {
    this.events = []
    this.stats = {
      totalEvents: 0,
      cacheHits: 0,
      cacheMisses: 0,
      verificationsStarted: 0,
      verificationsCompleted: 0,
      verificationsFailed: 0,
      collisionsDetected: 0,
      averageCacheHitTime: 0,
      averageVerificationTime: 0,
      cacheHitRate: 0,
      verificationSuccessRate: 0,
      lastUpdated: Date.now()
    }
  }

  // Log summary to console
  logSummary(): void {
    const insights = this.getPerformanceInsights()
    
    console.group('📊 Metadata Telemetry Summary')
    console.log(`Total Events: ${this.stats.totalEvents}`)
    console.log(`Cache Hit Rate: ${(this.stats.cacheHitRate * 100).toFixed(1)}%`)
    console.log(`Average Cache Hit Time: ${this.stats.averageCacheHitTime.toFixed(2)}ms`)
    console.log(`Verification Success Rate: ${(this.stats.verificationSuccessRate * 100).toFixed(1)}%`)
    console.log(`Average Verification Time: ${this.stats.averageVerificationTime.toFixed(2)}ms`)
    console.log(`Collisions Detected: ${this.stats.collisionsDetected}`)
    console.log(`Cache Performance: ${insights.cachePerformance}`)
    console.log(`Verification Performance: ${insights.verificationPerformance}`)
    
    if (insights.recommendations.length > 0) {
      console.log('Recommendations:')
      insights.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
    console.groupEnd()
  }
}

// Export singleton instance
export const metadataTelemetry = new MetadataTelemetry()

// Auto-log summary every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (metadataTelemetry.getStats().totalEvents > 0) {
      metadataTelemetry.logSummary()
    }
  }, 5 * 60 * 1000) // 5 minutes
}
