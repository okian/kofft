import React, { ReactNode } from "react";
import { useDesign } from "./DesignContext";
import { JapaneseLayout } from "./themes/japanese/JapaneseLayout";
import { BauhausLayout } from "./themes/bauhaus/BauhausLayout";
import type { Design } from "./designs";

/**
 * Valid design identifiers that map to the Japanese layout. Keeping the list
 * centralised avoids scattered string comparisons and eases future extension.
 */
const JAPANESE_DESIGNS: readonly Design[] = ["japanese-a", "japanese-b"] as const;

/** Properties accepted by {@link DesignLayout}. */
export interface DesignLayoutProps {
  /** Element rendered at the top of the page. */
  readonly header: ReactNode;
  /** Element rendered at the bottom of the page. */
  readonly footer: ReactNode;
  /** Main application content. */
  readonly children: ReactNode;
}

/**
 * Render the appropriate layout for the current design system. The component
 * delegates to either {@link JapaneseLayout} or {@link BauhausLayout} and
 * throws fast when encountering an unsupported design value.
 */
export function DesignLayout({ header, footer, children }: DesignLayoutProps) {
  const { design } = useDesign();
  if (header == null) throw new Error("header is required");
  if (footer == null) throw new Error("footer is required");
  if (children == null) throw new Error("children are required");

  if (JAPANESE_DESIGNS.includes(design)) {
    return <JapaneseLayout header={header} footer={footer}>{children}</JapaneseLayout>;
  }

  if (design === "bauhaus") {
    return <BauhausLayout header={header} footer={footer}>{children}</BauhausLayout>;
  }

  throw new Error(`Unsupported design: ${design}`);
}
