import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

/** Path to the TypeScript source defining animation duration constants. */
const tsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/ui/AnimationDurations.ts",
);
/** Destination path for the generated CSS variables file. */
const cssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/ui/animation-durations.css",
);

/**
 * Generate a CSS file exposing theme animation variables from TypeScript
 * constants. Reading the source file rather than duplicating values keeps
 * styles and logic in lockstep.
 */
async function main() {
  const src = await readFile(tsPath, "utf8");
  const match = src.match(/THEME_ANIMATION_MS\s*=\s*(\d+)/);
  if (!match) {
    throw new Error(
      "Failed to extract THEME_ANIMATION_MS from AnimationDurations.ts",
    );
  }
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) {
    throw new Error("Parsed THEME_ANIMATION_MS is not a finite number");
  }
  const css = [
    "/* Auto-generated from AnimationDurations.ts. Do not edit manually. */",
    ":root {",
    `  --anim-duration: ${ms}ms;`,
    "}",
    "",
  ].join("\n");
  await writeFile(cssPath, css);
}

main().catch((err) => {
  console.error("Failed to build animation duration CSS", err);
  process.exitCode = 1;
});
