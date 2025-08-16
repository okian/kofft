import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../src/components/Sidebar";
import { GENERIC_VINYL } from "../src/utils/vinyl";

describe("Sidebar", () => {
  it("renders metadata", () => {
    render(
      <Sidebar
        metadata={{
          title: "T",
          artist: "A",
          album: "AL",
          year: "2020",
          duration: 90,
          picture: GENERIC_VINYL,
        }}
      />,
    );
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("handles missing metadata", () => {
    render(<Sidebar metadata={null} />);
    expect(screen.getByText(/No track loaded/)).toBeInTheDocument();
  });
});
