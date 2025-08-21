# Japanese Theme

This theme offers two minimalist options:

- **OptionA** – strict monochrome using only black and white.
- **OptionB** – adds a muted red accent while retaining the minimal aesthetic.

Both options provide light and dark modes. Colours are defined via exported
constants (`WHITE`, `BLACK`, `RED`) to remove magic values and encourage reuse.

`JapaneseLayout` arranges header, content and footer in a vertical column with
balanced spacing (`LAYOUT_GAP_REM`). Sections fade in using the `useMinimalFades`
hook which wraps a simple CSS `opacity` transition. Memoisation is employed to
minimise allocations and maintain performance.
