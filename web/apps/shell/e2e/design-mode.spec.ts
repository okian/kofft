import { test, expect } from '@playwright/test';
import { PALETTES, Design, Mode } from '../src/designs';

/** Selector for the HTML root element used to store attributes. */
const ROOT_SELECTOR = 'html';
/** Selector for the design dropdown control. */
const DESIGN_SELECT = '[data-testid="design-select"]';
/** Selector for the mode dropdown control. */
const MODE_SELECT = '[data-testid="mode-select"]';

/** CSS variable holding the background colour. */
const VAR_BG = '--color-bg';
/** CSS variable holding the default text colour. */
const VAR_TEXT = '--color-text';
/** CSS variable holding the primary accent colour. */
const VAR_ACCENT = '--color-accent';
/** CSS variable holding the secondary accent colour. */
const VAR_SECONDARY = '--color-secondary';
/** CSS variable holding the tertiary accent colour. */
const VAR_TERTIARY = '--color-tertiary';

/** Designs supported by the application under test. */
const DESIGNS: readonly Design[] = ['japanese-a', 'japanese-b', 'bauhaus'];
/** Colour modes toggled by the user. */
const MODES: readonly Mode[] = ['light', 'dark'];

/**
 * Retrieve a computed CSS variable from the document root.
 * @param page Playwright page instance.
 * @param name Name of the CSS variable to read.
 * @returns The trimmed value of the variable.
 */
async function readVar(page: any, name: string): Promise<string> {
  return page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
}

/**
 * Cycle through all design and mode combinations, ensuring the DOM attributes
 * and CSS variables reflect the expected palette values.
 */
test('design and mode toggling updates attributes and CSS variables', async ({ page }) => {
  await page.goto('/');
  for (const design of DESIGNS) {
    await page.locator(DESIGN_SELECT).selectOption(design);
    for (const mode of MODES) {
      await page.locator(MODE_SELECT).selectOption(mode);
      const root = page.locator(ROOT_SELECTOR);
      await expect(root).toHaveAttribute('data-design', design);
      await expect(root).toHaveAttribute('data-mode', mode);
      const palette = PALETTES[design][mode];
      expect(await readVar(page, VAR_BG)).toBe(palette.background);
      expect(await readVar(page, VAR_TEXT)).toBe(palette.text);
      expect(await readVar(page, VAR_ACCENT)).toBe(palette.accent);
      const secondary = await readVar(page, VAR_SECONDARY);
      if (palette.secondary) {
        expect(secondary).toBe(palette.secondary);
      } else {
        expect(secondary).toBe('');
      }
      const tertiary = await readVar(page, VAR_TERTIARY);
      if (palette.tertiary) {
        expect(tertiary).toBe(palette.tertiary);
      } else {
        expect(tertiary).toBe('');
      }
    }
  }
});
