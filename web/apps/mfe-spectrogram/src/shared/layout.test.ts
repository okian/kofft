import { describe, it, expect } from 'vitest'
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, GRID, getPanelClasses } from './layout'
import { getHeaderClasses } from '@/layout/Header'
import { getFooterClasses } from '@/layout/Footer'
import type { Theme } from '@/shared/types'

// Enumerate all supported themes to ensure token maps stay in sync.
const ALL_THEMES: Theme[] = [
  'dark',
  'light',
  'neon',
  'high-contrast',
  'japanese-a-light',
  'japanese-a-dark',
  'japanese-b-light',
  'japanese-b-dark',
  'bauhaus-light',
  'bauhaus-dark',
]

describe('layout tokens', () => {
  it('define spacing for every theme', () => {
    ALL_THEMES.forEach((t) => expect(SPACING).toHaveProperty(t))
  })
  it('define border radius for every theme', () => {
    ALL_THEMES.forEach((t) => expect(BORDER_RADIUS).toHaveProperty(t))
  })
  it('define typography for every theme', () => {
    ALL_THEMES.forEach((t) => expect(TYPOGRAPHY).toHaveProperty(t))
  })
  it('define grid units for every theme', () => {
    ALL_THEMES.forEach((t) => expect(GRID).toHaveProperty(t))
  })
})

describe('component class helpers', () => {
  it('header uses theme tokens', () => {
    const theme: Theme = 'japanese-a-light'
    const cls = getHeaderClasses(theme, true)
    expect(cls).toContain(SPACING[theme])
    expect(cls).toContain(TYPOGRAPHY[theme])
  })

  it('footer uses theme tokens', () => {
    const theme: Theme = 'bauhaus-dark'
    const cls = getFooterClasses(theme, 'h-12')
    expect(cls).toContain(SPACING[theme])
    expect(cls).toContain(BORDER_RADIUS[theme])
  })

  it('panel helper applies tokens', () => {
    const theme: Theme = 'dark'
    const cls = getPanelClasses(theme)
    expect(cls).toContain(GRID[theme])
    expect(cls).toContain(TYPOGRAPHY[theme])
  })
})
