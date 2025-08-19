import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface ControlSectionProps {
  /** URL for the square album art */
  art: string;
  /** Song title */
  title: string;
  /** Artist name */
  artist: string;
  /** Album name */
  album: string;
  /** Display mode */
  mode: "now" | "next";
}

interface DisplayedText {
  title: string;
  artist: string;
  album: string;
  mode: "now" | "next";
}

/**
 * ControlSection renders album art with song information and handles
 * transitions between "Now Playing" and "Coming Up" states.
 */
export function ControlSection({
  art,
  title,
  artist,
  album,
  mode,
}: ControlSectionProps) {
  const [displayed, setDisplayed] = useState<DisplayedText>({
    title,
    artist,
    album,
    mode,
  });
  const [fading, setFading] = useState(false);
  const [fadeDuration, setFadeDuration] = useState(200);
  const prevRef = useRef<DisplayedText>(displayed);

  useEffect(() => {
    const isStateChange = prevRef.current.mode !== mode;
    const duration = isStateChange ? 300 : 200;
    setFadeDuration(duration);
    setFading(true);
    const timeout = setTimeout(() => {
      setDisplayed({ title, artist, album, mode });
      setFading(false);
      prevRef.current = { title, artist, album, mode };
    }, duration);
    return () => clearTimeout(timeout);
  }, [title, artist, album, mode]);

  const metaText =
    displayed.mode === "now"
      ? `${displayed.artist} • ${displayed.album}`
      : "Coming Up Next";

  return (
    <div
      className={clsx(
        "control-section",
        displayed.mode === "next" && "coming-up",
        fading && "fading",
      )}
      style={{
        ["--fade-duration" as any]: `${fadeDuration}ms`,
        ["--title-scale" as any]: displayed.mode === "now" ? 3 : 1,
        ["--meta-scale" as any]: displayed.mode === "now" ? 1 : 3,
        ["--gap" as any]: displayed.mode === "now" ? "0.125rem" : "0.0625rem",
      }}
      data-testid="control-section"
    >
      <img src={art} alt="Album art" className="album-art" />
      <div className="text-stack">
        <div className="song-title" data-testid="song-title">
          {displayed.title}
        </div>
        <div className="song-meta" data-testid="song-meta">
          {metaText}
        </div>
      </div>
    </div>
  );
}

export default ControlSection;
