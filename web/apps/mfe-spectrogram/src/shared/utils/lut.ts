import { LUT, LUTEntry } from '../types'

/**
 * Built-in LUT definitions for common color schemes
 */
export const BUILTIN_LUTS: Record<string, LUT> = {
  'viridis': {
    id: 'viridis',
    name: 'Viridis',
    description: 'Perceptually uniform color map from dark blue to yellow',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.267004, 0.004874, 0.329415, 1.0] },
      { position: 0.25, color: [0.229739, 0.322361, 0.545706, 1.0] },
      { position: 0.5, color: [0.127568, 0.566949, 0.550556, 1.0] },
      { position: 0.75, color: [0.369214, 0.788888, 0.382914, 1.0] },
      { position: 1.0, color: [0.993248, 0.906157, 0.143936, 1.0] }
    ]
  },
  'plasma': {
    id: 'plasma',
    name: 'Plasma',
    description: 'Perceptually uniform color map from dark purple to yellow',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.050383, 0.029803, 0.527975, 1.0] },
      { position: 0.25, color: [0.363088, 0.027712, 0.538133, 1.0] },
      { position: 0.5, color: [0.657359, 0.222700, 0.409025, 1.0] },
      { position: 0.75, color: [0.906157, 0.479431, 0.217843, 1.0] },
      { position: 1.0, color: [0.993248, 0.906157, 0.143936, 1.0] }
    ]
  },
  'inferno': {
    id: 'inferno',
    name: 'Inferno',
    description: 'Perceptually uniform color map from black to bright yellow',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.001462, 0.000466, 0.013866, 1.0] },
      { position: 0.25, color: [0.466065, 0.003679, 0.013866, 1.0] },
      { position: 0.5, color: [0.866065, 0.217679, 0.013866, 1.0] },
      { position: 0.75, color: [0.993248, 0.906157, 0.143936, 1.0] },
      { position: 1.0, color: [0.988362, 0.998364, 0.644924, 1.0] }
    ]
  },
  'magma': {
    id: 'magma',
    name: 'Magma',
    description: 'Perceptually uniform color map from black to bright pink',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.001462, 0.000466, 0.013866, 1.0] },
      { position: 0.25, color: [0.466065, 0.003679, 0.013866, 1.0] },
      { position: 0.5, color: [0.866065, 0.217679, 0.013866, 1.0] },
      { position: 0.75, color: [0.993248, 0.906157, 0.143936, 1.0] },
      { position: 1.0, color: [0.988362, 0.998364, 0.644924, 1.0] }
    ]
  },
  'cividis': {
    id: 'cividis',
    name: 'Cividis',
    description: 'Colorblind-friendly perceptually uniform color map',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.000000, 0.126190, 0.301571, 1.0] },
      { position: 0.25, color: [0.000000, 0.205571, 0.401571, 1.0] },
      { position: 0.5, color: [0.000000, 0.305571, 0.501571, 1.0] },
      { position: 0.75, color: [0.000000, 0.405571, 0.601571, 1.0] },
      { position: 1.0, color: [0.000000, 0.505571, 0.701571, 1.0] }
    ]
  },
  'turbo': {
    id: 'turbo',
    name: 'Turbo',
    description: 'High contrast color map with smooth transitions',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.189950, 0.071760, 0.232170, 1.0] },
      { position: 0.25, color: [0.000000, 0.000000, 0.000000, 1.0] },
      { position: 0.5, color: [0.000000, 0.000000, 0.000000, 1.0] },
      { position: 0.75, color: [0.000000, 0.000000, 0.000000, 1.0] },
      { position: 1.0, color: [0.813333, 0.903333, 0.152941, 1.0] }
    ]
  },
  'rainbow': {
    id: 'rainbow',
    name: 'Rainbow',
    description: 'Classic rainbow color map',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [1.0, 0.0, 0.0, 1.0] },      // Red
      { position: 0.17, color: [1.0, 0.5, 0.0, 1.0] },    // Orange
      { position: 0.33, color: [1.0, 1.0, 0.0, 1.0] },    // Yellow
      { position: 0.5, color: [0.0, 1.0, 0.0, 1.0] },     // Green
      { position: 0.67, color: [0.0, 0.0, 1.0, 1.0] },    // Blue
      { position: 0.83, color: [0.5, 0.0, 1.0, 1.0] },    // Purple
      { position: 1.0, color: [1.0, 0.0, 1.0, 1.0] }      // Magenta
    ]
  },
  'fire': {
    id: 'fire',
    name: 'Fire',
    description: 'Fire-like color map from black to white',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.0, 0.0, 0.0, 1.0] },     // Black
      { position: 0.25, color: [0.5, 0.0, 0.5, 1.0] },    // Purple
      { position: 0.5, color: [1.0, 0.65, 0.0, 1.0] },    // Orange
      { position: 0.75, color: [1.0, 1.0, 0.0, 1.0] },    // Yellow
      { position: 1.0, color: [1.0, 1.0, 1.0, 1.0] }      // White
    ]
  },
  'grayscale': {
    id: 'grayscale',
    name: 'Grayscale',
    description: 'Simple grayscale color map',
    interpolation: 'linear',
    entries: [
      { position: 0.0, color: [0.0, 0.0, 0.0, 1.0] },     // Black
      { position: 1.0, color: [1.0, 1.0, 1.0, 1.0] }      // White
    ]
  }
}

/**
 * Interpolate between two colors using the specified method
 */
function interpolateColors(
  color1: [number, number, number, number],
  color2: [number, number, number, number],
  t: number,
  method: 'linear' | 'cubic' | 'step'
): [number, number, number, number] {
  switch (method) {
    case 'linear':
      return [
        color1[0] + (color2[0] - color1[0]) * t,
        color1[1] + (color2[1] - color1[1]) * t,
        color1[2] + (color2[2] - color1[2]) * t,
        color1[3] + (color2[3] - color1[3]) * t
      ]
    case 'cubic':
      // Cubic interpolation using smoothstep
      const smoothT = t * t * (3 - 2 * t)
      return [
        color1[0] + (color2[0] - color1[0]) * smoothT,
        color1[1] + (color2[1] - color1[1]) * smoothT,
        color1[2] + (color2[2] - color1[2]) * smoothT,
        color1[3] + (color2[3] - color1[3]) * smoothT
      ]
    case 'step':
      return t < 0.5 ? color1 : color2
    default:
      return color1
  }
}

/**
 * Find the two LUT entries that bracket the given position
 */
function findBracketingEntries(entries: LUTEntry[], position: number): [LUTEntry, LUTEntry] | null {
  if (entries.length < 2) return null
  
  // Sort entries by position to ensure proper ordering
  const sortedEntries = [...entries].sort((a, b) => a.position - b.position)
  
  // Find the two entries that bracket the position
  for (let i = 0; i < sortedEntries.length - 1; i++) {
    if (position >= sortedEntries[i].position && position <= sortedEntries[i + 1].position) {
      return [sortedEntries[i], sortedEntries[i + 1]]
    }
  }
  
  // If position is outside the range, return the closest entries
  if (position <= sortedEntries[0].position) {
    return [sortedEntries[0], sortedEntries[0]]
  }
  if (position >= sortedEntries[sortedEntries.length - 1].position) {
    return [sortedEntries[sortedEntries.length - 1], sortedEntries[sortedEntries.length - 1]]
  }
  
  return null
}

/**
 * Map a value (0.0 to 1.0) to a color using the specified LUT
 */
export function mapValueToColor(value: number, lut: LUT): [number, number, number, number] {
  // Clamp value to [0, 1]
  const clampedValue = Math.max(0, Math.min(1, value))
  
  // Find bracketing entries
  const bracketing = findBracketingEntries(lut.entries, clampedValue)
  if (!bracketing) {
    // Fallback to first entry
    return lut.entries[0]?.color || [0, 0, 0, 1]
  }
  
  const [entry1, entry2] = bracketing
  
  // If both entries are the same, return the color directly
  if (entry1.position === entry2.position) {
    return entry1.color
  }
  
  // Calculate interpolation factor
  const t = (clampedValue - entry1.position) / (entry2.position - entry1.position)
  
  // Interpolate between the two colors
  return interpolateColors(entry1.color, entry2.color, t, lut.interpolation)
}

/**
 * Generate a texture from a LUT for use in WebGL shaders
 */
export function generateLUTTexture(lut: LUT, resolution: number = 256): Uint8Array {
  console.log('Generating LUT texture for:', lut.name, 'with', lut.entries.length, 'entries')
  const texture = new Uint8Array(resolution * 4) // RGBA
  
  for (let i = 0; i < resolution; i++) {
    const value = i / (resolution - 1)
    const color = mapValueToColor(value, lut)
    
    const index = i * 4
    texture[index] = Math.round(color[0] * 255)     // R
    texture[index + 1] = Math.round(color[1] * 255) // G
    texture[index + 2] = Math.round(color[2] * 255) // B
    texture[index + 3] = Math.round(color[3] * 255) // A
  }
  
  // Log first and last few values for debugging
  console.log('LUT texture sample - first 4 pixels:', 
    Array.from(texture.slice(0, 16)).map(v => v.toString(16).padStart(2, '0')).join(' ')
  )
  console.log('LUT texture sample - last 4 pixels:', 
    Array.from(texture.slice(-16)).map(v => v.toString(16).padStart(2, '0')).join(' ')
  )
  
  // Test specific values
  const testValues = [0, 0.25, 0.5, 0.75, 1.0]
  console.log('LUT test values:')
  testValues.forEach(value => {
    const color = mapValueToColor(value, lut)
    console.log(`  ${value} -> [${color.map(c => c.toFixed(3)).join(', ')}]`)
  })
  
  return texture
}

/**
 * Create a custom LUT from a list of colors
 */
export function createCustomLUT(
  id: string,
  name: string,
  colors: [number, number, number, number][],
  interpolation: 'linear' | 'cubic' | 'step' = 'linear',
  description?: string
): LUT {
  const entries: LUTEntry[] = colors.map((color, index) => ({
    position: index / (colors.length - 1),
    color
  }))
  
  return {
    id,
    name,
    description,
    entries,
    interpolation
  }
}

/**
 * Import a LUT from a file (supports common formats)
 */
export function importLUTFromFile(file: File): Promise<LUT> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const lut = parseLUTFile(content, file.name)
        resolve(lut)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Parse LUT file content (supports .cube format)
 */
function parseLUTFile(content: string, filename: string): LUT {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))
  
  // Try to parse as .cube format
  if (filename.toLowerCase().endsWith('.cube')) {
    return parseCubeFormat(lines, filename)
  }
  
  throw new Error(`Unsupported LUT file format: ${filename}`)
}

/**
 * Parse .cube format LUT files
 */
function parseCubeFormat(lines: string[], filename: string): LUT {
  const entries: LUTEntry[] = []
  let size = 0
  
  for (const line of lines) {
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1])
    } else if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      // Skip domain definitions for now
      continue
    } else if (/^\d/.test(line)) {
      // Parse RGB values
      const values = line.split(/\s+/).map(v => parseFloat(v))
      if (values.length >= 3) {
        const [r, g, b] = values
        const position = entries.length / (size * size * size)
        entries.push({
          position: Math.min(1, position),
          color: [r, g, b, 1.0]
        })
      }
    }
  }
  
  if (entries.length === 0) {
    throw new Error('No valid color entries found in .cube file')
  }
  
  // Limit the number of entries to prevent storage issues
  const maxEntries = 1024
  if (entries.length > maxEntries) {
    console.warn(`LUT has ${entries.length} entries, limiting to ${maxEntries} to prevent storage issues`)
    const limitedEntries: LUTEntry[] = []
    for (let i = 0; i < maxEntries; i++) {
      const index = Math.floor((i / (maxEntries - 1)) * (entries.length - 1))
      limitedEntries.push(entries[index])
    }
    entries.splice(0, entries.length, ...limitedEntries)
  }
  
  return {
    id: `imported-${Date.now()}`,
    name: filename.replace(/\.[^/.]+$/, ''),
    description: `Imported from ${filename} (${entries.length} entries)`,
    entries,
    interpolation: 'linear'
  }
}

/**
 * Export a LUT to .cube format
 */
export function exportLUTToCube(lut: LUT): string {
  const size = Math.ceil(Math.sqrt(lut.entries.length))
  let content = `# LUT generated by Kofft Spectrogram\n`
  content += `# ${lut.name}\n`
  content += `# ${lut.description || ''}\n\n`
  content += `LUT_3D_SIZE ${size}\n`
  content += `DOMAIN_MIN 0.0 0.0 0.0\n`
  content += `DOMAIN_MAX 1.0 1.0 1.0\n\n`
  
  // Generate 3D LUT entries
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const value = (r + g * size + b * size * size) / (size * size * size - 1)
        const color = mapValueToColor(value, lut)
        content += `${color[0].toFixed(6)} ${color[1].toFixed(6)} ${color[2].toFixed(6)}\n`
      }
    }
  }
  
  return content
}
