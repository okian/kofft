/**
 * Utility for capturing the current spectrogram canvas and either triggering a
 * download or delegating to a consumer-provided callback. The helper obtains
 * the canvas reference from the spectrogram store so callers don't need direct
 * access to the rendering component.
 */
import { useSpectrogramStore } from "@/shared/stores/spectrogramStore";

/** Filename used when saving snapshots to disk. */
const DEFAULT_FILENAME = "spectrogram.png" as const;

/** MIME type for generated snapshot images. */
const PNG_MIME_TYPE = "image/png" as const;

/**
 * Options controlling snapshot behaviour.
 * `onCapture` is invoked with the captured image blob. If omitted a file
 * download is triggered instead.
 */
export interface SnapshotOptions {
  /** Optional filename for the downloaded image. */
  filename?: string;
  /** Callback receiving the captured PNG blob. */
  onCapture?: (blob: Blob) => void;
}

/**
 * Captures the current spectrogram canvas. Returns `true` when the canvas was
 * successfully captured and the result was either downloaded or passed to the
 * callback. Returns `false` when no canvas is available or capture fails.
 */
export async function takeSnapshot(
  options: SnapshotOptions = {},
): Promise<boolean> {
  const { canvasRef } = useSpectrogramStore.getState();
  const canvas = canvasRef?.getCanvas();
  if (!canvas) {
    return false;
  }

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), PNG_MIME_TYPE),
  );

  if (!blob) {
    return false;
  }

  try {
    if (options.onCapture) {
      options.onCapture(blob);
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = options.filename ?? DEFAULT_FILENAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return true;
  } catch {
    return false;
  }
}
