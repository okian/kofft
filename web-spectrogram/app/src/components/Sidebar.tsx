import React from "react";
import { TrackMetadata } from "../utils/metadata";

interface Props {
  metadata: TrackMetadata | null;
}

export function Sidebar({ metadata }: Props) {
  if (!metadata) {
    return <aside className="sidebar">No track loaded</aside>;
  }

  const { picture, title, artist, album, year, duration } = metadata;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.round(duration % 60)
    .toString()
    .padStart(2, "0");

  return (
    <aside className="sidebar">
      <img src={picture} alt="Album art" className="album-art" />
      <h2>{title}</h2>
      <p>{artist}</p>
      <p>{album}</p>
      <p>{year}</p>
      <p>{`${minutes}:${seconds}`}</p>
    </aside>
  );
}
