import { describe, it, expect, vi } from "vitest";
import { createIdlePeaksAnimator, createLivePeaksAnimator } from "../waveform";

// Helper delay using fake timers to execute requestAnimationFrame callbacks.
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe("waveform animators", () => {
  it("animates placeholder peaks over time", async () => {
    vi.useFakeTimers();
    const samples: number[] = [];
    const stop = createIdlePeaksAnimator(4, (p) => samples.push(p[0]));
    await advance(16);
    await advance(100);
    stop();
    vi.useRealTimers();
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0]).not.toBeCloseTo(samples[samples.length - 1]);
  });

  it("consumes live time data", async () => {
    vi.useFakeTimers();
    let phase = 0;
    const getTime = () => {
      const arr = new Uint8Array(32);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 128 + Math.round(50 * Math.sin(phase));
      }
      phase += Math.PI / 2;
      return arr;
    };
    const samples: number[] = [];
    const stop = createLivePeaksAnimator(getTime, 4, (p) => samples.push(p[0]));
    await advance(16);
    await advance(16);
    stop();
    vi.useRealTimers();
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0]).not.toBeCloseTo(samples[samples.length - 1]);
  });
});
