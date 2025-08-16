import { parseBlob } from "music-metadata-browser";
import { GENERIC_VINYL } from "./vinyl";

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  duration: number;
  picture: string;
}

export async function extractMetadata(file: File): Promise<TrackMetadata> {
  const metadata = await parseBlob(file);
  const common = metadata.common;
  const pic = common.picture && common.picture[0];
  let picture: string;
  if (pic) {
    picture = `data:${pic.format};base64,${Buffer.from(pic.data).toString("base64")}`;
  } else {
    picture = GENERIC_VINYL;
  }
  return {
    title: common.title || file.name,
    artist: common.artist || "Unknown Artist",
    album: common.album || "Unknown Album",
    year: common.year ? String(common.year) : "",
    duration: metadata.format.duration || 0,
    picture,
  };
}
