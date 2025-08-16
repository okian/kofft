import { describe, it, expect, vi } from "vitest";
import { extractMetadata } from "../src/utils/metadata";
import { parseBlob } from "music-metadata-browser";

vi.mock("music-metadata-browser");

const mockedParse = vi.mocked(parseBlob);

describe("extractMetadata", () => {
  it("uses embedded picture when present", async () => {
    mockedParse.mockResolvedValueOnce({
      common: {
        title: "Song",
        artist: "Artist",
        album: "Album",
        year: 2020,
        picture: [{ data: Uint8Array.from([1, 2, 3]), format: "image/png" }],
      },
      format: { duration: 120 },
    } as any);

    const file = new File([""], "test.mp3");
    const md = await extractMetadata(file);
    expect(md.picture).toContain("data:image/png;base64");
    expect(md.title).toBe("Song");
  });

  it("falls back to generic vinyl when no picture", async () => {
    mockedParse.mockResolvedValueOnce({
      common: {
        title: "Song",
        artist: "Artist",
        album: "Album",
        year: 2020,
      },
      format: { duration: 120 },
    } as any);

    const file = new File([""], "test.mp3");
    const md = await extractMetadata(file);
    expect(md.picture).toMatch(/^data:image\/svg/);
  });
});
