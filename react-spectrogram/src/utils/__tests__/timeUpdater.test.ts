import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTimeUpdater } from "../timeUpdater";

describe("createTimeUpdater", () => {
  let rafCallbacks: Record<number, FrameRequestCallback>;
  let rafId = 0;
  type RafEnv = {
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
    cancelAnimationFrame: (id: number) => void;
  };
  let rafEnv: RafEnv;

  beforeEach(() => {
    rafCallbacks = {};
    rafId = 0;
    rafEnv = globalThis as unknown as RafEnv;
    // Mock rAF/cAF to provide deterministic control over the loop
    rafEnv.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks[id] = cb;
      return id;
    });
    rafEnv.cancelAnimationFrame = vi.fn((id: number) => {
      delete rafCallbacks[id];
    });
  });

  it("invokes callbacks until shouldContinue returns false", () => {
    let time = 0;
    const onUpdate = vi.fn();
    const updater = createTimeUpdater({
      getTime: () => ++time,
      onUpdate,
      shouldContinue: (t) => t < 2,
    });

    updater.start();
    // First frame
    rafCallbacks[1]();
    // Second frame; shouldContinue now false so loop stops
    rafCallbacks[2]();

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenNthCalledWith(1, 1);
    expect(onUpdate).toHaveBeenNthCalledWith(2, 2);
    expect(rafEnv.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(rafEnv.cancelAnimationFrame).toHaveBeenCalledTimes(0);
  });

  it("stop cancels the scheduled frame", () => {
    const updater = createTimeUpdater({
      getTime: () => 0,
      onUpdate: () => {},
    });
    updater.start();
    updater.stop();
    expect(rafEnv.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("throws on invalid time values", () => {
    const updater = createTimeUpdater({
      getTime: () => NaN,
      onUpdate: () => {},
    });
    updater.start();
    expect(() => rafCallbacks[1]()).toThrow("Invalid time value");
    expect(rafEnv.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
