import React, { useState, useEffect } from 'react'
import { optimisticMetadataStore } from '@/shared/utils/optimisticMetadataStore'
import { metadataVerificationWorker } from '@/shared/utils/metadataVerificationWorker'
import { metadataTelemetry } from '@/shared/utils/metadataTelemetry'
import { cn } from '@/shared/utils/cn'

interface OptimisticMetadataPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const OptimisticMetadataPanel: React.FC<OptimisticMetadataPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [stats, setStats] = useState<any>(null)
  const [telemetryStats, setTelemetryStats] = useState<any>(null)
  const [queueStatus, setQueueStatus] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshStats = async () => {
    setIsRefreshing(true)
    try {
      const [dbStats, telemetry, queue] = await Promise.all([
        optimisticMetadataStore.getStats(),
        metadataTelemetry.getStats(),
        metadataVerificationWorker.getQueueStatus()
      ])
      setStats(dbStats)
      setTelemetryStats(telemetry)
      setQueueStatus(queue)
    } catch (error) {
      console.error('Failed to refresh stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      refreshStats()
      const interval = setInterval(refreshStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all optimistic metadata? This will remove all cached metadata and artwork.')) {
      try {
        await optimisticMetadataStore.clearAll()
        await refreshStats()
      } catch (error) {
        console.error('Failed to clear cache:', error)
      }
    }
  }

  const handleClearTelemetry = () => {
    if (confirm('Are you sure you want to clear all telemetry data?')) {
      metadataTelemetry.clear()
      refreshStats()
    }
  }

  const handleCleanup = async () => {
    try {
      const deletedCount = await optimisticMetadataStore.cleanupOldEntries()
      alert(`Cleaned up ${deletedCount} old entries`)
      await refreshStats()
    } catch (error) {
      console.error('Failed to cleanup:', error)
    }
  }

  const getPerformanceColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-500'
    if (rate >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getStatusColor = (isRunning: boolean) => {
    return isRunning ? 'text-green-500' : 'text-red-500'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Optimistic Metadata System
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Refresh Button */}
        <div className="mb-4">
          <button
            onClick={refreshStats}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Database Statistics */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Database Statistics
            </h3>
            {stats && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Track Index:</span>
                  <span className="font-mono">{stats.trackIndexCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Metadata Cache:</span>
                  <span className="font-mono">{stats.metadataCacheCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Artwork Cache:</span>
                  <span className="font-mono">{stats.artworkCacheCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Verified:</span>
                  <span className="font-mono text-green-600">{stats.verifiedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Unverified:</span>
                  <span className="font-mono text-yellow-600">{stats.unverifiedCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance Statistics */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Performance Statistics
            </h3>
            {telemetryStats && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Cache Hit Rate:</span>
                  <span className={cn("font-mono", getPerformanceColor(telemetryStats.cacheHitRate))}>
                    {(telemetryStats.cacheHitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Avg Cache Hit Time:</span>
                  <span className="font-mono">{telemetryStats.averageCacheHitTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Verification Success Rate:</span>
                  <span className={cn("font-mono", getPerformanceColor(telemetryStats.verificationSuccessRate))}>
                    {(telemetryStats.verificationSuccessRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Avg Verification Time:</span>
                  <span className="font-mono">{telemetryStats.averageVerificationTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Collisions Detected:</span>
                  <span className="font-mono text-red-600">{telemetryStats.collisionsDetected}</span>
                </div>
              </div>
            )}
          </div>

          {/* Verification Queue Status */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Verification Queue
            </h3>
            {queueStatus && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status:</span>
                  <span className={cn("font-mono", getStatusColor(queueStatus.isRunning))}>
                    {queueStatus.isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Queue Size:</span>
                  <span className="font-mono">{queueStatus.queueSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Processing:</span>
                  <span className="font-mono">{queueStatus.processingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Paused:</span>
                  <span className="font-mono">{queueStatus.isPaused ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Worker Statistics */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Worker Statistics
            </h3>
            {telemetryStats && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Total Events:</span>
                  <span className="font-mono">{telemetryStats.totalEvents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Cache Hits:</span>
                  <span className="font-mono text-green-600">{telemetryStats.cacheHits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Cache Misses:</span>
                  <span className="font-mono text-red-600">{telemetryStats.cacheMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Verifications Started:</span>
                  <span className="font-mono">{telemetryStats.verificationsStarted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Verifications Completed:</span>
                  <span className="font-mono text-green-600">{telemetryStats.verificationsCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Verifications Failed:</span>
                  <span className="font-mono text-red-600">{telemetryStats.verificationsFailed}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Performance Insights */}
        {telemetryStats && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Performance Insights
            </h3>
            {(() => {
              const insights = metadataTelemetry.getPerformanceInsights()
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Cache Performance:</span>
                    <span className="font-medium">{insights.cachePerformance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Verification Performance:</span>
                    <span className="font-medium">{insights.verificationPerformance}</span>
                  </div>
                  {insights.recommendations.length > 0 && (
                    <div className="mt-3">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">Recommendations:</span>
                      <ul className="mt-1 space-y-1">
                        {insights.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-700 dark:text-gray-300 ml-4">
                            • {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Cleanup Old Entries
          </button>
          <button
            onClick={handleClearTelemetry}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Clear Telemetry
          </button>
          <button
            onClick={handleClearCache}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All Cache
          </button>
          <button
            onClick={() => metadataTelemetry.logSummary()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Log Summary
          </button>
        </div>

        {/* Export Data */}
        <div className="mt-4">
          <button
            onClick={() => {
              const data = metadataTelemetry.exportData()
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `metadata-telemetry-${new Date().toISOString().split('T')[0]}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export Telemetry Data
          </button>
        </div>
      </div>
    </div>
  )
}
