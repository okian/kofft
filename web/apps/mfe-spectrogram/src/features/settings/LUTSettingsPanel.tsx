import React, { useState, useRef } from 'react'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { BUILTIN_LUTS, importLUTFromFile, exportLUTToCube, createCustomLUT, mapValueToColor } from '@/shared/utils/lut'
import { LUT, LUTMode } from '@/shared/types'
import { cn } from '@/shared/utils/cn'
import { LUTDebugPanel } from '@/components/debug/LUTDebugPanel'
import { LUTTestButton } from '@/components/debug/LUTTestButton'
import { LUTForceTest } from '@/components/debug/LUTForceTest'
import { LUTSimpleTest } from '@/components/debug/LUTSimpleTest'
import { WebGLTest } from '@/components/debug/WebGLTest'
import { SpectrogramDataTest } from '@/components/debug/SpectrogramDataTest'
import { useSpectrogramStore } from '@/shared/stores/spectrogramStore'

export function LUTSettingsPanel() {
  const {
    lutMode,
    currentLUT,
    customLUTs,
    setLUTMode,
    setCurrentLUT,
    addCustomLUT,
    removeCustomLUT,
    updateCustomLUT
  } = useSettingsStore()
  const { addTestData } = useSpectrogramStore()

  const [selectedLUT, setSelectedLUT] = useState<LUT | null>(currentLUT)
  const [isImporting, setIsImporting] = useState(false)
  const [previewLUT, setPreviewLUT] = useState<LUT | null>(null)
  const [previewFileName, setPreviewFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLUTModeChange = (mode: LUTMode) => {
    setLUTMode(mode)
    if (mode === 'builtin') {
      setCurrentLUT(null)
      setSelectedLUT(null)
    }
  }

  const handleBuiltinLUTSelect = (lutId: string) => {
    const lut = BUILTIN_LUTS[lutId]
    if (lut) {
      console.log('Selecting builtin LUT:', lutId, lut)
      setCurrentLUT(lut)
      setSelectedLUT(lut)
      setLUTMode('builtin')
      // Also update the colormap to match the selected LUT
      const { setColormap } = useSettingsStore.getState()
      setColormap(lutId)
    }
  }

  const handleCustomLUTSelect = (lut: LUT) => {
    setCurrentLUT(lut)
    setSelectedLUT(lut)
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const lut = await importLUTFromFile(file)
      // Show preview first
      setPreviewLUT(lut)
      setPreviewFileName(file.name)
    } catch (error) {
      console.error('Failed to import LUT:', error)
      alert(`Failed to import LUT: ${error}`)
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleApplyPreview = () => {
    if (!previewLUT) return
    
    console.log('Applying preview LUT:', previewLUT)
    addCustomLUT(previewLUT)
    setCurrentLUT(previewLUT)
    setSelectedLUT(previewLUT)
    setLUTMode('custom')
    console.log('LUT mode set to custom, currentLUT set to:', previewLUT.name)
    setPreviewLUT(null)
    setPreviewFileName('')
    setIsImporting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCancelPreview = () => {
    setPreviewLUT(null)
    setPreviewFileName('')
    setIsImporting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const generateLUTPreview = (lut: LUT) => {
    const colors: string[] = []
    const steps = 64 // Generate 64 color stops for smooth preview
    
    for (let i = 0; i < steps; i++) {
      const value = i / (steps - 1)
      const color = mapValueToColor(value, lut)
      const hexColor = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`
      colors.push(hexColor)
    }
    
    return `linear-gradient(to right, ${colors.join(', ')})`
  }

  const handleExportLUT = () => {
    if (!selectedLUT) return

    const content = exportLUTToCube(selectedLUT)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedLUT.name}.cube`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCreateCustomLUT = () => {
    const newLUT = createCustomLUT(
      `custom-${Date.now()}`,
      'Custom LUT',
      [
        [0, 0, 0, 1],      // Black
        [0.5, 0, 0.5, 1],  // Purple
        [1, 0.65, 0, 1],   // Orange
        [1, 1, 0, 1],      // Yellow
        [1, 1, 1, 1]       // White
      ],
      'linear',
      'Custom color map'
    )
    addCustomLUT(newLUT)
    setCurrentLUT(newLUT)
    setSelectedLUT(newLUT)
    setLUTMode('custom')
  }

  const handleDeleteCustomLUT = (lut: LUT) => {
    if (confirm(`Are you sure you want to delete "${lut.name}"?`)) {
      removeCustomLUT(lut.id)
      if (currentLUT?.id === lut.id) {
        setCurrentLUT(null)
        setSelectedLUT(null)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Color Mapping (LUT)
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Configure how frequency data is mapped to colors in the spectrogram.
        </p>
      </div>

      {/* LUT Mode Selection */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Color Map Source
          </label>
          <div className="mt-2 space-y-2">
            {(['builtin', 'custom', 'file'] as const).map((mode) => (
              <label key={mode} className="flex items-center">
                <input
                  type="radio"
                  name="lutMode"
                  value={mode}
                  checked={lutMode === mode}
                  onChange={() => handleLUTModeChange(mode)}
                  className="mr-2"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
                  {mode === 'builtin' ? 'Built-in Maps' : mode === 'custom' ? 'Custom Maps' : 'Import from File'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Built-in LUTs */}
        {lutMode === 'builtin' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Built-in Color Maps
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BUILTIN_LUTS).map(([id, lut]) => (
                <button
                  key={id}
                  onClick={() => handleBuiltinLUTSelect(id)}
                  className={cn(
                    "p-3 text-left border rounded-lg transition-colors",
                    selectedLUT?.id === id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                  )}
                >
                  <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                    {lut.name}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    {lut.description}
                  </div>
                  <div 
                    className="mt-2 h-4 rounded" 
                    style={{ background: generateLUTPreview(lut) }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom LUTs */}
        {lutMode === 'custom' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Custom Color Maps
              </label>
              <button
                onClick={handleCreateCustomLUT}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Create New
              </button>
            </div>
            {customLUTs.length === 0 ? (
              <div className="text-sm text-neutral-600 dark:text-neutral-400 p-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg">
                No custom color maps yet. Create one or import from a file.
              </div>
            ) : (
              <div className="space-y-2">
                {customLUTs.map((lut) => (
                  <div
                    key={lut.id}
                    className={cn(
                      "p-3 border rounded-lg transition-colors",
                      selectedLUT?.id === lut.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-neutral-200 dark:border-neutral-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleCustomLUTSelect(lut)}
                        className="flex-1 text-left"
                      >
                        <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                          {lut.name}
                        </div>
                        {lut.description && (
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                            {lut.description}
                          </div>
                        )}
                        <div 
                          className="mt-2 h-3 rounded" 
                          style={{ background: generateLUTPreview(lut) }}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomLUT(lut)}
                        className="ml-2 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Import */}
        {lutMode === 'file' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Import Color Map File
            </label>
            <div className="p-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept=".cube"
                onChange={handleFileImport}
                disabled={isImporting}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Choose .cube file'}
              </button>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                Supports .cube format LUT files
              </p>
            </div>

            {/* Preview Section */}
            {previewLUT && (
              <div className="mt-4 p-4 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Preview: {previewFileName}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyPreview}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleCancelPreview}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    <strong>Name:</strong> {previewLUT.name}
                  </div>
                  {previewLUT.description && (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      <strong>Description:</strong> {previewLUT.description}
                    </div>
                  )}
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    <strong>Interpolation:</strong> {previewLUT.interpolation}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    <strong>Entries:</strong> {previewLUT.entries.length}
                  </div>
                  
                  {/* Color Preview */}
                  <div className="mt-3">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Color Map Preview:
                    </div>
                    <div 
                      className="h-8 rounded border border-neutral-300 dark:border-neutral-600" 
                      style={{ background: generateLUTPreview(previewLUT) }}
                    />
                  </div>
                  
                  {/* Entry Preview */}
                  <div className="mt-3">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Color Stops:
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                      {previewLUT.entries.slice(0, 10).map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div
                            className="w-4 h-4 rounded border border-neutral-300 dark:border-neutral-600"
                            style={{
                              backgroundColor: `rgba(${Math.round(entry.color[0] * 255)}, ${Math.round(entry.color[1] * 255)}, ${Math.round(entry.color[2] * 255)}, ${entry.color[3]})`
                            }}
                          />
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {Math.round(entry.position * 100)}%
                          </span>
                        </div>
                      ))}
                      {previewLUT.entries.length > 10 && (
                        <div className="text-xs text-neutral-500 col-span-2">
                          ... and {previewLUT.entries.length - 10} more entries
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Current LUT */}
      {selectedLUT && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Current Color Map: {selectedLUT.name}
              </h4>
              {selectedLUT.description && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  {selectedLUT.description}
                </p>
              )}
            </div>
            <button
              onClick={handleExportLUT}
              className="px-3 py-1 text-sm bg-neutral-600 text-white rounded hover:bg-neutral-700 transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <LUTDebugPanel />
        <div className="mt-4">
          <LUTTestButton />
        </div>
        <div className="mt-4">
          <LUTForceTest />
        </div>
        <div className="mt-4">
          <LUTSimpleTest />
        </div>
        <div className="mt-4">
          <WebGLTest />
        </div>
        <div className="mt-4">
          <SpectrogramDataTest onAddTestData={addTestData} />
        </div>
      </div>
    </div>
  )
}
