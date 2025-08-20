import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { StatisticsPanel } from "@/components/layout/StatisticsPanel";
import {
  recordPlayStart,
  recordPlayProgress,
  recordPlayEnd,
  resetStats,
  configureUsageStats,
} from "@/shared/utils/usageStats";

vi.mock("@/shared/utils/toast", () => ({ directToast: vi.fn() }));

beforeEach(async () => {
  await resetStats();
  configureUsageStats({ playThresholdSeconds: 1 });
  await recordPlayStart({ id: "a", title: "Alpha" });
  await recordPlayProgress("a", 1);
  await recordPlayEnd("a");
  await recordPlayStart({ id: "b", title: "Beta" });
  await recordPlayProgress("b", 1);
  await recordPlayEnd("b");
});

describe("StatisticsPanel", () => {
  it("filters tracks by search", async () => {
    render(<StatisticsPanel />);
    await screen.findByText("Alpha");
    const input = screen.getByPlaceholderText("Search songs...");
    fireEvent.change(input, { target: { value: "bet" } });
    await waitFor(() => {
      expect(screen.queryByText("Alpha")).toBeNull();
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });
  });

  it("resets statistics", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<StatisticsPanel />);
    await screen.findByText("Alpha");
    const resetBtn = screen.getByText("Reset Statistics");
    fireEvent.click(resetBtn);
    await waitFor(() => {
      expect(screen.getByText("Songs: 0")).toBeInTheDocument();
    });
  });
});
