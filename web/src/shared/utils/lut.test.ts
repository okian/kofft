import { describe, it, expect } from 'vitest'
import { BUILTIN_LUTS, mapValueToColor, generateLUTTexture, createCustomLUT } from './lut'

describe('LUT Utilities', () => {
  describe('BUILTIN_LUTS', () => {
    it('should have valid LUT definitions', () => {
      expect(BUILTIN_LUTS).toBeDefined()
      expect(Object.keys(BUILTIN_LUTS).length).toBeGreaterThan(0)
      
      Object.entries(BUILTIN_LUTS).forEach(([id, lut]) => {
        expect(lut.id).toBe(id)
        expect(lut.name).toBeDefined()
        expect(lut.entries).toBeDefined()
        expect(lut.entries.length).toBeGreaterThan(0)
        expect(lut.interpolation).toBeDefined()
        
        // Check that entries are sorted by position
        for (let i = 1; i < lut.entries.length; i++) {
          expect(lut.entries[i].position).toBeGreaterThanOrEqual(lut.entries[i - 1].position)
        }
      })
    })
  })

  describe('mapValueToColor', () => {
    it('should map values to colors correctly', () => {
      const lut = BUILTIN_LUTS.viridis
      const color = mapValueToColor(0.5, lut)
      
      expect(color).toHaveLength(4)
      expect(color[0]).toBeGreaterThanOrEqual(0)
      expect(color[0]).toBeLessThanOrEqual(1)
      expect(color[1]).toBeGreaterThanOrEqual(0)
      expect(color[1]).toBeLessThanOrEqual(1)
      expect(color[2]).toBeGreaterThanOrEqual(0)
      expect(color[2]).toBeLessThanOrEqual(1)
      expect(color[3]).toBeGreaterThanOrEqual(0)
      expect(color[3]).toBeLessThanOrEqual(1)
    })

    it('should clamp values to [0, 1]', () => {
      const lut = BUILTIN_LUTS.viridis
      const color1 = mapValueToColor(-0.5, lut)
      const color2 = mapValueToColor(1.5, lut)
      
      expect(color1).toEqual(mapValueToColor(0, lut))
      expect(color2).toEqual(mapValueToColor(1, lut))
    })
  })

  describe('generateLUTTexture', () => {
    it('should generate texture data', () => {
      const lut = BUILTIN_LUTS.viridis
      const texture = generateLUTTexture(lut, 256)
      
      expect(texture).toBeInstanceOf(Uint8Array)
      expect(texture.length).toBe(256 * 4) // RGBA
      
      // Check that all values are in valid range
      for (let i = 0; i < texture.length; i++) {
        expect(texture[i]).toBeGreaterThanOrEqual(0)
        expect(texture[i]).toBeLessThanOrEqual(255)
      }
    })
  })

  describe('createCustomLUT', () => {
    it('should create a custom LUT', () => {
      const colors: [number, number, number, number][] = [
        [0, 0, 0, 1],
        [1, 1, 1, 1]
      ]
      
      const lut = createCustomLUT('test', 'Test LUT', colors, 'linear', 'Test description')
      
      expect(lut.id).toBe('test')
      expect(lut.name).toBe('Test LUT')
      expect(lut.description).toBe('Test description')
      expect(lut.interpolation).toBe('linear')
      expect(lut.entries).toHaveLength(2)
      expect(lut.entries[0].position).toBe(0)
      expect(lut.entries[1].position).toBe(1)
    })
  })
})
