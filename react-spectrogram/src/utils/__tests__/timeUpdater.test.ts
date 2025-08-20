import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTimeUpdater, TIME_UPDATE_INTERVAL_MS } from "../timeUpdater";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 10),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("createTimeUpdater", () => {
  it("throttles callbacks to the configured interval", () => {
    const onUpdate = vi.fn();
    const updater = createTimeUpdater({
      onUpdate: (now) => {
        onUpdate(now);
        updater.record(now);
      },
      shouldUpdate: () => true,
    });
    updater.record();
    updater.start();
    vi.advanceTimersByTime(10);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("respects manual record() calls", () => {
    const onUpdate = vi.fn();
    const updater = createTimeUpdater({
      onUpdate: (now) => {
        onUpdate(now);
        updater.record(now);
      },
      shouldUpdate: () => true,
    });
    updater.record();
    updater.start();
    vi.advanceTimersByTime(TIME_UPDATE_INTERVAL_MS);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updater.record();
    vi.advanceTimersByTime(10);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("stops when stop() is called", () => {
    const onUpdate = vi.fn();
    const updater = createTimeUpdater({
      onUpdate: (now) => {
        onUpdate(now);
        updater.record(now);
      },
      shouldUpdate: () => true,
    });
    updater.record();
    updater.start();
    updater.stop();
    vi.advanceTimersByTime(TIME_UPDATE_INTERVAL_MS * 2);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("throws on invalid configuration", () => {
    // @ts-expect-error deliberate misconfiguration
    expect(() => createTimeUpdater({})).toThrow();
  });
});
