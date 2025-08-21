# Bauhaus Theme

The Bauhaus design embraces primary colours and strict geometry. The palette
exports reusable constants (`WHITE`, `BLACK`, `RED`, `BAUHAUS_BLUE`,
`BAUHAUS_YELLOW`) to remove magic values and keep colour usage consistent.
`BAUHAUS_LIGHT_PALETTE` and `BAUHAUS_DARK_PALETTE` combine these hues for the
two supported modes.

`BauhausLayout` employs a CSS grid (`GRID_COLUMNS`) to arrange header, content
and footer while offering geometric primitives `Block` and `Line`. These
primitives encourage composition of bold rectilinear forms characteristic of the
movement. Animation is handled by `useGridTransitions` which performs lightweight
transform-based slides without triggering reflow.
