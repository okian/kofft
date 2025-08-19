import { optimisticMetadataStore, computeOptimisticKey } from './optimisticMetadataStore'
import { extractMetadata } from './wasm'
import { extractArtwork } from './artwork'
import { AudioMetadata } from '@/types'
import { metadataTelemetry } from './metadataTelemetry'

// Verification worker configuration
const VERIFICATION_CONFIG = {
  BATCH_SIZE: 3, // Process 3 items at a time
  DELAY_BETWEEN_BATCHES: 1000, // 1 second between batches
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds between retries
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  MAX_QUEUE_SIZE: 100 // Maximum items in verification queue
} as const

interface VerificationTask {
  key: string
  fileName: string
  fileSize: number
  arrayBuffer: ArrayBuffer
  retryCount: number
  priority: number
}

class MetadataVerificationWorker {
  private isRunning = false
  private isPaused = false
  private taskQueue: VerificationTask[] = []
  private processingTasks = new Set<string>()
  private cleanupInterval: number | null = null
  private stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    collisions: 0,
    retries: 0
  }

  constructor() {
    this.startCleanupInterval()
  }

  // Start the verification worker
  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    this.isPaused = false
    console.log('🚀 Metadata verification worker started')

    // Process existing queue items
    await this.processQueue()

    // Start continuous processing
    this.processContinuously()
  }

  // Stop the verification worker
  stop(): void {
    this.isRunning = false
    this.isPaused = false
    console.log('🛑 Metadata verification worker stopped')
  }

  // Pause the verification worker
  pause(): void {
    this.isPaused = true
    console.log('⏸️ Metadata verification worker paused')
  }

  // Resume the verification worker
  resume(): void {
    this.isPaused = false
    console.log('▶️ Metadata verification worker resumed')
  }

  // Add a verification task to the queue
  async addVerificationTask(
    fileName: string,
    fileSize: number,
    arrayBuffer: ArrayBuffer,
    priority: number = 1
  ): Promise<void> {
    const key = computeOptimisticKey(fileName, fileSize)
    
    // Check if already processing this key
    if (this.processingTasks.has(key)) {
      console.log('⏳ Task already in progress for key:', key)
      return
    }

    // Check if already in queue
    const existingTaskIndex = this.taskQueue.findIndex(task => task.key === key)
    if (existingTaskIndex !== -1) {
      // Update priority if higher
      const existingTask = this.taskQueue[existingTaskIndex]
      if (priority > existingTask.priority) {
        existingTask.priority = priority
        // Re-sort queue by priority
        this.taskQueue.sort((a, b) => b.priority - a.priority)
        console.log('📈 Updated priority for key:', key, 'to', priority)
      }
      return
    }

    // Add to queue
    const task: VerificationTask = {
      key,
      fileName,
      fileSize,
      arrayBuffer,
      retryCount: 0,
      priority
    }

    this.taskQueue.push(task)
    
    // Sort by priority (higher priority first)
    this.taskQueue.sort((a, b) => b.priority - a.priority)

    // Limit queue size
    if (this.taskQueue.length > VERIFICATION_CONFIG.MAX_QUEUE_SIZE) {
      const removed = this.taskQueue.splice(VERIFICATION_CONFIG.MAX_QUEUE_SIZE)
      console.log(`🗑️ Removed ${removed.length} low-priority tasks from queue`)
    }

    console.log('📋 Added verification task for key:', key, 'priority:', priority, 'queue size:', this.taskQueue.length)
  }

  // Process the verification queue
  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.isPaused) return

    const batch = this.taskQueue.splice(0, VERIFICATION_CONFIG.BATCH_SIZE)
    
    if (batch.length === 0) {
      // No tasks to process, wait a bit and try again
      setTimeout(() => this.processQueue(), VERIFICATION_CONFIG.DELAY_BETWEEN_BATCHES)
      return
    }

    console.log(`🔄 Processing batch of ${batch.length} verification tasks`)

    // Process batch in parallel
    const promises = batch.map(task => this.processTask(task))
    await Promise.allSettled(promises)

    // Schedule next batch
    setTimeout(() => this.processQueue(), VERIFICATION_CONFIG.DELAY_BETWEEN_BATCHES)
  }

  // Process a single verification task
  private async processTask(task: VerificationTask): Promise<void> {
    const { key, fileName, fileSize, arrayBuffer, retryCount } = task
    
    // Mark as processing
    this.processingTasks.add(key)
    
    try {
      console.log(`🔍 Verifying metadata for key: ${key} (attempt ${retryCount + 1})`)
      
      // Record verification start
      metadataTelemetry.recordVerificationStart(key, fileName, fileSize)
      const startTime = performance.now()
      
      // Create a File object for metadata extraction
      const file = new File([arrayBuffer], fileName, {
        type: this.getMimeType(fileName)
      })

      // Extract metadata using WASM
      const verifiedMetadata = await extractMetadata(file)
      
      // Extract artwork
      const artworkResult = await extractArtwork(verifiedMetadata, fileName, arrayBuffer)
      if (artworkResult.artwork) {
        verifiedMetadata.album_art = artworkResult.artwork.data
        verifiedMetadata.album_art_mime = artworkResult.artwork.mimeType
      }

      // Verify and update in optimistic store
      const result = await optimisticMetadataStore.verifyAndUpdateMetadata(
        key,
        fileName,
        fileSize,
        verifiedMetadata,
        arrayBuffer
      )

      this.stats.processed++
      const duration = performance.now() - startTime
      
      if (result.collision) {
        this.stats.collisions++
        metadataTelemetry.recordCollisionDetected(key, fileName, fileSize)
        console.warn(`⚠️ Content collision detected for key: ${key}`)
      } else {
        this.stats.succeeded++
        metadataTelemetry.recordVerificationComplete(key, fileName, fileSize, duration, verifiedMetadata)
        console.log(`✅ Metadata verification completed for key: ${key}`)
      }

    } catch (error) {
      this.stats.failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      metadataTelemetry.recordVerificationFailed(key, fileName, fileSize, errorMessage)
      console.error(`❌ Metadata verification failed for key: ${key}:`, error)

      // Retry logic
      if (retryCount < VERIFICATION_CONFIG.MAX_RETRIES) {
        this.stats.retries++
        task.retryCount = retryCount + 1
        
        // Add back to queue with exponential backoff
        const delay = VERIFICATION_CONFIG.RETRY_DELAY * Math.pow(2, retryCount)
        setTimeout(() => {
          this.taskQueue.push(task)
          this.taskQueue.sort((a, b) => b.priority - a.priority)
        }, delay)
        
        console.log(`🔄 Scheduled retry for key: ${key} in ${delay}ms (attempt ${task.retryCount})`)
      } else {
        console.error(`💀 Max retries exceeded for key: ${key}`)
      }
    } finally {
      // Remove from processing set
      this.processingTasks.delete(key)
    }
  }

  // Continuous processing loop
  private async processContinuously(): Promise<void> {
    while (this.isRunning) {
      if (!this.isPaused) {
        await this.processQueue()
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Get MIME type from file extension
  private getMimeType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'webm': 'audio/webm'
    }
    return mimeTypes[extension || ''] || 'audio/mpeg'
  }

  // Start cleanup interval
  private startCleanupInterval(): void {
    this.cleanupInterval = window.setInterval(async () => {
      try {
        const deletedCount = await optimisticMetadataStore.cleanupOldEntries()
        if (deletedCount > 0) {
          console.log(`🧹 Cleaned up ${deletedCount} old metadata entries`)
        }
      } catch (error) {
        console.error('❌ Cleanup failed:', error)
      }
    }, VERIFICATION_CONFIG.CLEANUP_INTERVAL)
  }

  // Get worker statistics
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  // Get queue status
  getQueueStatus(): {
    queueSize: number
    processingCount: number
    isRunning: boolean
    isPaused: boolean
  } {
    return {
      queueSize: this.taskQueue.length,
      processingCount: this.processingTasks.size,
      isRunning: this.isRunning,
      isPaused: this.isPaused
    }
  }

  // Clear statistics
  clearStats(): void {
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      collisions: 0,
      retries: 0
    }
  }

  // Cleanup on destroy
  destroy(): void {
    this.stop()
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.taskQueue = []
    this.processingTasks.clear()
    console.log('🗑️ Metadata verification worker destroyed')
  }
}

// Export singleton instance
export const metadataVerificationWorker = new MetadataVerificationWorker()

// Auto-start the worker when the module is loaded
if (typeof window !== 'undefined') {
  // Start worker after a short delay to allow app initialization
  setTimeout(() => {
    metadataVerificationWorker.start().catch(error => {
      console.error('Failed to start metadata verification worker:', error)
    })
  }, 2000)
}
