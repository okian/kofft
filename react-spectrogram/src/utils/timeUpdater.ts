/**
 * Utility to create a time updater loop driven by `requestAnimationFrame`.
 *
 * The engines in this project often need to dispatch playback time updates
 * while audio is playing. Previously each engine implemented its own loop,
 * which led to subtle differences and duplicated logic.  This helper
 * centralises the logic, guaranteeing consistent behaviour and making it
 * trivial to test.
 *
 * The updater is intentionally minimal and allocation‑free: it only works
 * with numbers and avoids creating new objects on every frame to keep the
 * garbage collector at bay.
 */
export interface TimeUpdaterOptions {
  /**
   * Returns the current playback time in seconds.  The function **must**
   * return a finite, non‑negative number.  It is evaluated on every frame so
   * it should be cheap and side‑effect free.
   */
  getTime: () => number;

  /**
   * Invoked after `getTime` with the freshly obtained time value. Consumers
   * typically store the value and notify listeners of the change.
   */
  onUpdate: (time: number) => void;

  /**
   * Optional predicate invoked after `onUpdate`. When it returns `true` the
   * updater schedules the next animation frame; returning `false` stops the
   * loop.  If omitted the updater will continue indefinitely.
   */
  shouldContinue?: (time: number) => boolean;
}

export interface TimeUpdater {
  /** Start the update loop. Calling multiple times has no effect. */
  start(): void;
  /** Stop the loop if running. */
  stop(): void;
}

/**
 * Create a `TimeUpdater` instance.  It exposes `start` and `stop` methods used
 * by the engines to control the update loop.  The function validates all
 * inputs, failing fast when it encounters an invalid time value to prevent
 * infinite loops or NaN propagation.
 */
export function createTimeUpdater(options: TimeUpdaterOptions): TimeUpdater {
  let frameId: number | null = null;

  // Cancel the scheduled frame and reset the identifier.
  const stop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const update = () => {
    const time = options.getTime();

    // Validate time to catch programming errors early.
    if (!Number.isFinite(time) || time < 0) {
      stop();
      throw new Error(`Invalid time value: ${time}`);
    }

    options.onUpdate(time);

    const shouldContinue = options.shouldContinue
      ? options.shouldContinue(time)
      : true;

    if (shouldContinue) {
      frameId = requestAnimationFrame(update);
    } else {
      frameId = null;
    }
  };

  return {
    start() {
      // Guard against double scheduling; start is idempotent.
      if (frameId === null) {
        frameId = requestAnimationFrame(update);
      }
    },
    stop,
  };
}

export default createTimeUpdater;
