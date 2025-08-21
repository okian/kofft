// Utility for capturing spectrogram canvas snapshots.
// Provides a single function `takeSnapshot` that converts the current
// spectrogram canvas to a PNG data URL and either downloads it or passes it
// to a caller-supplied callback. The function validates all inputs and
// fails fast with clear errors so that calling code can provide user
// feedback. The implementation avoids unnecessary allocations and cleans up
// any created DOM nodes to prevent memory leaks.

/**
 * Default filename used when saving a spectrogram snapshot.
 * Named constant avoids hard-coded strings throughout the codebase.
 */
export const DEFAULT_SNAPSHOT_FILENAME = "spectrogram-snapshot.png" as const;

/** Message shown when a snapshot is successfully captured. */
export const SNAPSHOT_SUCCESS_MESSAGE = "Snapshot saved" as const;

/** Message shown when snapshot capture fails. */
export const SNAPSHOT_ERROR_MESSAGE = "Failed to capture snapshot" as const;

/**
 * Options for the `takeSnapshot` utility.
 * `canvas`   - The canvas element to capture. Required.
 * `fileName` - Optional file name for the download. Defaults to
 *              `DEFAULT_SNAPSHOT_FILENAME`.
 * `onSnapshot` - Optional callback invoked with the data URL. Use this
 *                when the host application wants to handle storage itself
 *                instead of triggering a download.
 */
export interface SnapshotOptions {
  canvas: HTMLCanvasElement | null;
  fileName?: string;
  onSnapshot?: (dataUrl: string) => void;
}

/**
 * Capture the provided canvas as a PNG image.
 *
 * @param options - Configuration describing how the snapshot should be
 *                  handled.
 * @returns The PNG data URL representing the snapshot.
 * @throws If the canvas is null/undefined or if canvas serialization fails.
 */
export function takeSnapshot(options: SnapshotOptions): string {
  const { canvas, fileName = DEFAULT_SNAPSHOT_FILENAME, onSnapshot } = options;

  // Validate input early to fail fast and surface clear errors to callers.
  if (!canvas) {
    throw new Error("takeSnapshot: canvas is required");
  }

  // toDataURL is synchronous and returns a base64-encoded string. We call it
  // once to avoid extra allocations or conversions.
  const dataUrl = canvas.toDataURL("image/png");

  if (onSnapshot) {
    // Delegate saving to caller for maximum flexibility. This avoids DOM
    // manipulation when not needed and lets apps persist the data in state
    // or elsewhere.
    onSnapshot(dataUrl);
  } else {
    // Trigger a download by creating a temporary anchor element. The element
    // is immediately removed after the click to avoid polluting the DOM.
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    // The click is synchronous; no need to append to the DOM first.
    link.click();
    link.remove();
  }

  return dataUrl;
}
