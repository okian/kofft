import React, { useState } from 'react'
import { BUILTIN_LUTS, createCustomLUT, mapValueToColor } from '@/shared/utils/lut'
import { LUT } from '@/shared/types'

export function LUTExample() {
  const [selectedLUT, setSelectedLUT] = useState<LUT>(BUILTIN_LUTS.viridis)
  const [customColors, setCustomColors] = useState<[number, number, number, number][]>([
    [0, 0, 0, 1],
    [0.5, 0, 0.5, 1],
    [1, 0.65, 0, 1],
    [1, 1, 0, 1],
    [1, 1, 1, 1]
  ])

  const generatePreview = (lut: LUT) => {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')!
    
    for (let x = 0; x < canvas.width; x++) {
      const value = x / canvas.width
      const color = mapValueToColor(value, lut)
      ctx.fillStyle = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`
      ctx.fillRect(x, 0, 1, canvas.height)
    }
    
    return canvas.toDataURL()
  }

  const handleCreateCustomLUT = () => {
    const newLUT = createCustomLUT(
      `custom-${Date.now()}`,
      'Custom LUT',
      customColors,
      'linear',
      'Custom color map'
    )
    setSelectedLUT(newLUT)
  }

  const updateCustomColor = (index: number, component: number, value: number) => {
    const newColors = [...customColors]
    newColors[index][component] = value
    setCustomColors(newColors)
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">LUT (Look-Up Table) Example</h2>
      
      {/* Built-in LUTs */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Built-in Color Maps</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(BUILTIN_LUTS).map(([id, lut]) => (
            <button
              key={id}
              onClick={() => setSelectedLUT(lut)}
              className={`p-4 border rounded-lg text-left transition-colors ${
                selectedLUT.id === id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="font-medium">{lut.name}</div>
              <div className="text-sm text-gray-600 mt-1">{lut.description}</div>
              <div className="mt-2 h-8 rounded" style={{ background: `url(${generatePreview(lut)})` }} />
            </button>
          ))}
        </div>
      </div>

      {/* Custom LUT Creator */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Custom Color Map Creator</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {customColors.map((color, index) => (
              <div key={index} className="space-y-2">
                <div className="text-sm font-medium">Color {index + 1}</div>
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={color[0]}
                    onChange={(e) => updateCustomColor(index, 0, parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={color[1]}
                    onChange={(e) => updateCustomColor(index, 1, parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={color[2]}
                    onChange={(e) => updateCustomColor(index, 2, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div
                  className="w-full h-8 rounded border"
                  style={{
                    backgroundColor: `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`
                  }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleCreateCustomLUT}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Custom LUT
          </button>
        </div>
      </div>

      {/* Selected LUT Preview */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Selected Color Map Preview</h3>
        <div className="p-4 border rounded-lg">
          <div className="font-medium">{selectedLUT.name}</div>
          {selectedLUT.description && (
            <div className="text-sm text-gray-600 mt-1">{selectedLUT.description}</div>
          )}
          <div className="mt-4 h-12 rounded" style={{ background: `url(${generatePreview(selectedLUT)})` }} />
          <div className="mt-2 text-sm text-gray-600">
            Interpolation: {selectedLUT.interpolation} | Entries: {selectedLUT.entries.length}
          </div>
        </div>
      </div>
    </div>
  )
}
