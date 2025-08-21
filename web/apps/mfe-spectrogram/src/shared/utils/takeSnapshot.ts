/**
 * Default filename used when saving a spectrogram snapshot to disk.
 * Having a named constant avoids scattering magic strings and simplifies
 * future refactors such as localisation.
 */
export const DEFAULT_SNAPSHOT_FILENAME = "spectrogram-snapshot.png";

/**
 * Configuration options for the takeSnapshot utility. Callers may provide
 * a specific canvas and opt-out of the automatic download behaviour.
 */
export interface SnapshotOptions {
  /**
   * Canvas element to capture. When omitted the utility searches the DOM for
   * the spectrogram canvas via its data-testid attribute. Passing a canvas
   * reference avoids DOM queries and is slightly faster.
   */
  canvas?: HTMLCanvasElement | null;
  /**
   * Filename used when triggering a download. Defaults to
   * DEFAULT_SNAPSHOT_FILENAME.
   */
  fileName?: string;
  /**
   * Whether the utility should automatically download the captured image.
   * Disable to merely receive the data URL and handle it externally.
   */
  triggerDownload?: boolean;
}

/**
 * Capture the current spectrogram canvas as a PNG image. The PNG data URL is
 * returned so callers may store it in application state. When
 * `triggerDownload` is true (default), a synthetic download is initiated.
 *
 * @throws Error if no canvas is available or the capture process fails.
 */
export const takeSnapshot = async ({
  canvas,
  fileName = DEFAULT_SNAPSHOT_FILENAME,
  triggerDownload = true,
}: SnapshotOptions = {}): Promise<string> => {
  try {
    // Prefer the explicitly provided canvas, otherwise search the DOM for
    // the spectrogram element. This keeps the utility reusable across
    // components without tight coupling.
    const target =
      canvas ??
      document.querySelector<HTMLCanvasElement>(
        '[data-testid="spectrogram-canvas"]',
      );
    if (!target) {
      throw new Error("Spectrogram canvas not found");
    }

    // Export the canvas to a PNG data URL. toDataURL performs the encoding
    // in-place without creating intermediate canvas copies, keeping memory
    // usage minimal.
    const dataUrl = target.toDataURL("image/png");

    if (triggerDownload) {
      // Create a temporary link to prompt the browser to download the image.
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      // Using click() avoids adding the element to the DOM, keeping the
      // operation lightweight.
      link.click();
    }

    return dataUrl;
  } catch (err) {
    // Normalise unknown errors into Error instances to aid caller handling.
    const error = err instanceof Error ? err : new Error(String(err));
    throw error;
  }
};
