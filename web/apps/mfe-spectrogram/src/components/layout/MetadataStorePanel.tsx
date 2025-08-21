import { useState, useEffect } from 'react'
import { Trash2, Database, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
import { metadataStore } from '@/shared/utils/metadataStore'
import { conditionalToast } from '@/shared/utils/toast'

interface DatabaseStats {
  metadataCount: number
  albumCount: number
  artistCount: number
  genreCount: number
  yearCount: number
  albumArtCount: number
  trackCount: number
}

export function MetadataStorePanel() {
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  const loadStats = async () => {
    try {
      setIsLoading(true)
      const databaseStats = await metadataStore.getStats()
      setStats(databaseStats)
    } catch (error) {
      console.error('Failed to load database stats:', error)
      conditionalToast.error('Failed to load database statistics')
    } finally {
      setIsLoading(false)
    }
  }

  const cleanupUnusedAlbumArt = async () => {
    try {
      setIsCleaning(true)
      const deletedCount = await metadataStore.cleanupUnusedAlbumArt()
      conditionalToast.success(`Cleaned up ${deletedCount} unused album art records`)
      await loadStats() // Refresh stats
    } catch (error) {
      console.error('Failed to cleanup unused album art:', error)
      conditionalToast.error('Failed to cleanup unused album art')
    } finally {
      setIsCleaning(false)
    }
  }

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to clear all metadata? This action cannot be undone.')) {
      return
    }

    try {
      setIsLoading(true)
      await metadataStore.clearAll()
      conditionalToast.success('All metadata cleared successfully')
      await loadStats() // Refresh stats
    } catch (error) {
      console.error('Failed to clear all data:', error)
      conditionalToast.error('Failed to clear all data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
          <Database size={20} />
          Metadata Database
        </h3>
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="icon-btn"
          title="Refresh statistics"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-blue-400" />
              <span className="text-sm font-medium text-neutral-300">Database Statistics</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Tracks:</span>
                <span className="text-neutral-100 font-mono">{stats.trackCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Metadata Records:</span>
                <span className="text-neutral-100 font-mono">{stats.metadataCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Albums:</span>
                <span className="text-neutral-100 font-mono">{stats.albumCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Artists:</span>
                <span className="text-neutral-100 font-mono">{stats.artistCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Genres:</span>
                <span className="text-neutral-100 font-mono">{stats.genreCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Years:</span>
                <span className="text-neutral-100 font-mono">{stats.yearCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Album Art:</span>
                <span className="text-neutral-100 font-mono">{stats.albumArtCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-yellow-400" />
              <span className="text-sm font-medium text-neutral-300">Database Management</span>
            </div>
            <div className="space-y-3">
              <button
                onClick={cleanupUnusedAlbumArt}
                disabled={isCleaning}
                className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                {isCleaning ? 'Cleaning...' : 'Clean Unused Album Art'}
              </button>
              
              <button
                onClick={clearAllData}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-neutral-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-neutral-300 mb-2">About IndexedDB Storage</h4>
        <div className="text-xs text-neutral-400 space-y-1">
          <p>• Metadata is stored in IndexedDB for better performance and larger storage capacity</p>
          <p>• Album art is deduplicated - only one copy is stored per unique image</p>
          <p>• Automatic cleanup removes unused album art older than 30 days</p>
          <p>• Data persists between browser sessions</p>
          <p>• Much more efficient than localStorage for large collections</p>
        </div>
      </div>

      {isLoading && !stats && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="animate-spin text-neutral-400" />
          <span className="ml-2 text-neutral-400">Loading database statistics...</span>
        </div>
      )}
    </div>
  )
}
