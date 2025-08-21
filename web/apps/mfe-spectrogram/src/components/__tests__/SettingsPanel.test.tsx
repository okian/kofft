import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock settings store and toast utilities before importing the component under test.
const mockValidateAPIKey = vi.fn();
const toastError = vi.fn();

vi.mock("@/shared/stores/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({ validateAPIKey: mockValidateAPIKey }),
  },
}));

vi.mock("@/shared/utils/toast", () => ({
  conditionalToast: {
    success: vi.fn(),
    error: toastError,
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { SettingsPanel } from "../layout/SettingsPanel";

/**
 * Baseline settings object used by tests. Individual cases override fields to
 * exercise specific behaviours without mutating the shared reference.
 */
const mockSettings = {
  theme: "japanese-a-light" as const,
  amplitudeScale: "db" as const,
  frequencyScale: "logarithmic" as const,
  resolution: "medium" as const,
  refreshRate: 60 as const,
  colormap: "viridis",
  showLegend: true,
  enableToastNotifications: false,
  seekPlayedColor: "",
  seekUnplayedColor: "",
  seekbarMode: "waveform" as const,
  seekbarSignificance: 0.5,
  seekbarAmplitudeScale: 1,
  apiKeys: {},
  apiKeyStatus: { acoustid: { valid: false }, musicbrainz: { valid: false } },
  enableExternalArtwork: true,
  enableAcoustID: true,
  enableMusicBrainz: true,
  enablePlaceholderArtwork: true,
};

const mockOnSettingsChange = vi.fn();
const mockOnClose = vi.fn();

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={false}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  // Ensures all supported design themes are rendered for user selection.
  it("renders all theme options", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    expect(screen.getByText("Japanese A Light")).toBeInTheDocument();
    expect(screen.getByText("Japanese A Dark")).toBeInTheDocument();
    expect(screen.getByText("Japanese B Light")).toBeInTheDocument();
    expect(screen.getByText("Japanese B Dark")).toBeInTheDocument();
    expect(screen.getByText("Bauhaus Light")).toBeInTheDocument();
    expect(screen.getByText("Bauhaus Dark")).toBeInTheDocument();
  });

  // Verifies that selecting a design theme propagates the expected value.
  it("handles theme selection", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const bauhausDarkButton = screen.getByText("Bauhaus Dark");
    fireEvent.click(bauhausDarkButton);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      theme: "bauhaus-dark",
    });
  });

  it("handles amplitude scale change", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const amplitudeScaleSection = screen
      .getByText("Amplitude Scale")
      .closest("div");
    const linearRadio = within(amplitudeScaleSection!).getByDisplayValue(
      "linear",
    );
    fireEvent.click(linearRadio);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      amplitudeScale: "linear",
    });
  });

  it("handles legend toggle", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const legendCheckbox = screen.getByRole("checkbox");
    fireEvent.click(legendCheckbox);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({ showLegend: false });
  });

  it("handles close button", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const closeButton = screen.getByTitle("Close (Esc)");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("handles reset to defaults", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const resetButton = screen.getByText("Reset to Defaults");
    fireEvent.click(resetButton);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      theme: "japanese-a-dark",
      amplitudeScale: "db",
      frequencyScale: "logarithmic",
      resolution: "medium",
      refreshRate: 60,
      colormap: "viridis",
      showLegend: true,
      enableToastNotifications: false,
      seekPlayedColor: "",
      seekUnplayedColor: "",
      seekbarMode: "waveform",
      seekbarSignificance: 0.5,
      seekbarAmplitudeScale: 1,
      enableExternalArtwork: true,
      enableAcoustID: true,
      enableMusicBrainz: true,
      enablePlaceholderArtwork: true,
      apiKeys: {},
      apiKeyStatus: {
        acoustid: { valid: false },
        musicbrainz: { valid: false },
      },
    });
  });

  it("allows overriding and resetting seekbar colours", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const playedInput = screen.getByLabelText("Played") as HTMLInputElement;
    fireEvent.input(playedInput, { target: { value: "#123456" } });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekPlayedColor: "#123456",
    });

    const unplayedInput = screen.getByLabelText("Unplayed") as HTMLInputElement;
    fireEvent.input(unplayedInput, { target: { value: "#654321" } });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekUnplayedColor: "#654321",
    });

    const resetButton = screen.getByText("Reset");
    fireEvent.click(resetButton);
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekPlayedColor: "",
      seekUnplayedColor: "",
    });
  });

  it("handles seekbar mode and scaling options", () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    // Change mode
    fireEvent.click(screen.getByLabelText("Animated Frequency Bars"));
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekbarMode: "frequency",
    });

    // Change significance level
    const sigInput = screen.getByLabelText("Significance") as HTMLInputElement;
    fireEvent.input(sigInput, { target: { value: "0.7" } });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekbarSignificance: 0.7,
    });

    // Change amplitude scale
    const ampInput = screen.getByLabelText(
      "Amplitude Scale",
    ) as HTMLInputElement;
    fireEvent.input(ampInput, { target: { value: "2" } });
    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      seekbarAmplitudeScale: 2,
    });
  });

  it("notifies when API key validation fails", async () => {
    const settingsWithKey = {
      ...mockSettings,
      apiKeys: { acoustid: "abc", musicbrainz: "" },
    };

    mockValidateAPIKey.mockRejectedValueOnce(new Error("network"));

    render(
      <SettingsPanel
        settings={settingsWithKey}
        isOpen={true}
        onClose={mockOnClose}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const testButtons = screen.getAllByText("Test");
    await fireEvent.click(testButtons[0]);

    expect(mockValidateAPIKey).toHaveBeenCalledWith("acoustid");
    expect(toastError).toHaveBeenCalled();
  });
});
