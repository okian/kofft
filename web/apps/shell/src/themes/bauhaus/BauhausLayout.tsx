import React, { CSSProperties, ReactNode, useMemo } from "react";
import { useGridTransitions } from "./useGridTransitions";
import { WHITE, BLACK, RED, BAUHAUS_BLUE, BAUHAUS_YELLOW } from "./palette";

/** Number of columns used in the Bauhaus grid. */
export const GRID_COLUMNS = 12 as const;

/** Gap between grid cells expressed in rem units. */
export const GRID_GAP_REM = 0.5 as const;

/** Full viewport height ensuring the layout fills the screen. */
const FULL_HEIGHT = "100vh" as const;

/** Union of allowed Bauhaus colours. */
export type BauhausColor =
  | typeof WHITE
  | typeof BLACK
  | typeof RED
  | typeof BAUHAUS_BLUE
  | typeof BAUHAUS_YELLOW;

/** Validate colour inputs to prevent invalid style injections. */
const PALETTE_COLORS: readonly BauhausColor[] = [
  WHITE,
  BLACK,
  RED,
  BAUHAUS_BLUE,
  BAUHAUS_YELLOW,
] as const;

function assertColor(color: string): asserts color is BauhausColor {
  if (!(PALETTE_COLORS as readonly string[]).includes(color)) {
    throw new Error(`Unsupported Bauhaus colour: ${color}`);
  }
}

/** Properties accepted by {@link Block}. */
export interface BlockProps {
  readonly color: BauhausColor;
  readonly column: number;
  readonly row: number;
  readonly columnSpan?: number;
  readonly rowSpan?: number;
}

/**
 * Render a rectangular block positioned within the grid.
 * Memoisation avoids allocating new style objects on each render,
 * reducing garbage collection pressure.
 */
export function Block({
  color,
  column,
  row,
  columnSpan = 1,
  rowSpan = 1,
}: BlockProps) {
  assertColor(color);
  if (column < 1 || row < 1) throw new Error("row and column must be >= 1");

  const { style: transitionStyle } = useGridTransitions();

  const style = useMemo<CSSProperties>(
    () => ({
      background: color,
      gridColumn: `${column} / span ${columnSpan}`,
      gridRow: `${row} / span ${rowSpan}`,
    }),
    [color, column, columnSpan, row, rowSpan],
  );

  return <div style={{ ...transitionStyle, ...style }} />;
}

/** Properties accepted by {@link Line}. */
export interface LineProps {
  readonly color: BauhausColor;
  readonly orientation: "horizontal" | "vertical";
  readonly index: number;
}

/** Thickness of rendered lines in rem units. */
export const LINE_THICKNESS_REM = 0.25 as const;

/**
 * Render a thin line spanning the grid in a single direction.
 * Orientation controls whether the line is horizontal or vertical.
 */
export function Line({ color, orientation, index }: LineProps) {
  assertColor(color);
  if (index < 1) throw new Error("index must be >= 1");

  const { style: transitionStyle } = useGridTransitions();

  const base = useMemo<CSSProperties>(() => ({ background: color }), [color]);

  if (orientation === "horizontal") {
    return (
      <div
        style={{
          ...transitionStyle,
          ...base,
          gridRow: index,
          gridColumn: `1 / span ${GRID_COLUMNS}`,
          height: `${LINE_THICKNESS_REM}rem`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...transitionStyle,
        ...base,
        gridColumn: index,
        gridRow: `1 / span ${GRID_COLUMNS}`,
        width: `${LINE_THICKNESS_REM}rem`,
      }}
    />
  );
}

/**
 * Properties accepted by {@link BauhausLayout}.
 * header   - element displayed at the top of the page.
 * footer   - element displayed at the bottom.
 * children - main content rendered in the centre.
 */
export interface BauhausLayoutProps {
  readonly header: ReactNode;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/**
 * Grid based layout placing header, content and footer in a vertical stack
 * while exposing geometric primitives for more elaborate compositions.
 */
export function BauhausLayout({
  header,
  footer,
  children,
}: BauhausLayoutProps) {
  if (header == null) throw new Error("header is required");
  if (footer == null) throw new Error("footer is required");
  if (children == null) throw new Error("children are required");

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
      gap: `${GRID_GAP_REM}rem`,
      minHeight: FULL_HEIGHT,
    }),
    [],
  );

  const { style: transitionStyle } = useGridTransitions();
  const spanning = useMemo<CSSProperties>(
    () => ({ gridColumn: `1 / span ${GRID_COLUMNS}` }),
    [],
  );

  return (
    <div style={containerStyle}>
      <header style={{ ...transitionStyle, ...spanning }}>{header}</header>
      <main style={{ ...transitionStyle, ...spanning }}>{children}</main>
      <footer style={{ ...transitionStyle, ...spanning }}>{footer}</footer>
    </div>
  );
}
