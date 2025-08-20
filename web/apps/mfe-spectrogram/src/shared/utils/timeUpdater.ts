/**
 * Utility for dispatching time-based updates with requestAnimationFrame while
 * throttling calls to avoid overwhelming subscribers.
 *
 * The updater keeps internal state for the last dispatch time and exposes
 * methods to start/stop the loop and to record manual dispatches. Consumers
 * must call `record()` whenever they notify outside the rAF loop to keep the
 * throttle consistent.
 */

// Shared interval used by audio engines. 20ms (~50Hz) balances UI responsiveness
// with computational cost.
export const TIME_UPDATE_INTERVAL_MS = 20;

/** Options for {@link createTimeUpdater}. */
export interface TimeUpdaterOptions {
  /** Called whenever an update should be dispatched. */
  onUpdate: (now: number) => void;
  /** Determines whether the update loop should continue. */
  shouldUpdate: () => boolean;
  /** Optional throttle interval override. */
  intervalMs?: number;
  /** requestAnimationFrame override for tests. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** cancelAnimationFrame override for tests. */
  cancelFrame?: (id: number) => void;
}

/** Control interface returned by {@link createTimeUpdater}. */
export interface TimeUpdater {
  /** Begin the update loop if not already running. */
  start(): void;
  /** Stop the update loop. Safe to call multiple times. */
  stop(): void;
  /** Record a manual dispatch time (e.g. after seek/pause events). */
  record(now?: number): void;
}

/**
 * Create a new time updater with the provided options. The updater uses
 * `requestAnimationFrame` for smooth updates but throttles calls to the
 * specified interval. Consumers are responsible for invoking `record()` after
 * manual dispatches to keep throttling consistent.
 */
export function createTimeUpdater(options: TimeUpdaterOptions): TimeUpdater {
  const {
    onUpdate,
    shouldUpdate,
    intervalMs = TIME_UPDATE_INTERVAL_MS,
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame,
  } = options;

  if (typeof onUpdate !== "function") {
    throw new Error("onUpdate must be a function");
  }
  if (typeof shouldUpdate !== "function") {
    throw new Error("shouldUpdate must be a function");
  }

  const interval =
    Number.isFinite(intervalMs) && intervalMs >= 0
      ? intervalMs
      : TIME_UPDATE_INTERVAL_MS;

  let frameId: number | null = null;
  let lastDispatch = 0;

  const frame = () => {
    if (!shouldUpdate()) {
      frameId = null;
      return;
    }
    const now = performance.now();
    if (now - lastDispatch >= interval) {
      onUpdate(now);
      // `onUpdate` should call `record()`; guard here just in case.
      lastDispatch = now;
    }
    frameId = requestFrame(frame);
  };

  return {
    start() {
      if (frameId !== null) return;
      frame();
    },
    stop() {
      if (frameId !== null) {
        cancelFrame(frameId);
        frameId = null;
      }
    },
    record(now: number = performance.now()) {
      if (!Number.isFinite(now)) {
        throw new Error("Invalid time passed to record()");
      }
      lastDispatch = now;
    },
  };
}
