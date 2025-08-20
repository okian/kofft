import { describe, it, expect, beforeEach } from "vitest";
import {
  recordPlayStart,
  recordPlayProgress,
  recordPlayEnd,
  getStats,
  resetStats,
  configureUsageStats,
} from "@/utils/usageStats";

// Use small threshold to speed up tests
beforeEach(async () => {
  await resetStats();
  configureUsageStats({ playThresholdSeconds: 3 });
});

describe("usageStats", () => {
  it("counts play only after threshold", async () => {
    await recordPlayStart({ id: "a", title: "Song A" });
    await recordPlayProgress("a", 2);
    await recordPlayEnd("a");
    let stats = await getStats();
    expect(stats.totalPlays).toBe(0);
    expect(stats.totalPlayTime).toBe(2);

    // second play exceeding threshold
    await recordPlayStart({ id: "a", title: "Song A" });
    await recordPlayProgress("a", 4);
    await recordPlayEnd("a");
    stats = await getStats();
    expect(stats.totalPlays).toBe(1);
    expect(stats.totalPlayTime).toBe(6);
  });

  it("ignores invalid progress", async () => {
    await recordPlayStart({ id: "b" });
    await recordPlayProgress("b", -5);
    await recordPlayProgress("b", Number.NaN);
    await recordPlayEnd("b");
    const stats = await getStats();
    expect(stats.totalPlayTime).toBe(0);
  });

  it("handles rapid track switching", async () => {
    await recordPlayStart({ id: "a" });
    await recordPlayProgress("a", 2);
    await recordPlayStart({ id: "b" });
    await recordPlayProgress("b", 4);
    await recordPlayEnd("b");
    await recordPlayEnd("a");
    const stats = await getStats();
    const trackA = stats.tracks.find((t) => t.id === "a")!;
    const trackB = stats.tracks.find((t) => t.id === "b")!;
    expect(trackA.playCount).toBe(0);
    expect(trackA.totalDuration).toBe(2);
    expect(trackB.playCount).toBe(1);
    expect(trackB.totalDuration).toBe(4);
  });
});
