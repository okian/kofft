import React, { CSSProperties, ReactNode, useMemo } from "react";
import { useMinimalFades } from "./useMinimalFades";

/** Vertical spacing between layout sections expressed in rem units. */
export const LAYOUT_GAP_REM = 1 as const;

/** Height of the layout viewport ensuring full-screen coverage. */
const FULL_HEIGHT = "100vh" as const;

/**
 * Properties required by {@link JapaneseLayout}.
 * header   - element displayed at the top of the page.
 * footer   - element displayed at the bottom.
 * children - main content rendered in the centre.
 */
export interface JapaneseLayoutProps {
  readonly header: ReactNode;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/**
 * Layout component arranging header, main content and footer using a
 * flex column. Each section fades in and shares balanced spacing.
 */
export function JapaneseLayout({
  header,
  footer,
  children,
}: JapaneseLayoutProps) {
  if (header == null) throw new Error("header is required");
  if (footer == null) throw new Error("footer is required");
  if (children == null) throw new Error("children are required");

  const { style: fadeStyle } = useMinimalFades();

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: `${LAYOUT_GAP_REM}rem`,
      minHeight: FULL_HEIGHT,
    }),
    [],
  );

  const mainStyle = useMemo<CSSProperties>(() => ({ flex: 1, display: "grid", placeItems: "center" }), []);

  return (
    <div style={containerStyle}>
      <header style={fadeStyle}>{header}</header>
      <main style={{ ...mainStyle, ...fadeStyle }}>{children}</main>
      <footer style={fadeStyle}>{footer}</footer>
    </div>
  );
}
