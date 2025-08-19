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
  const [currentArt, setCurrentArt] = useState(art);
  const [nextArt, setNextArt] = useState<string | null>(null);
  const [artAnimating, setArtAnimating] = useState(false);
  const prevArtRef = useRef({ album, mode });

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

  useEffect(() => {
    const prev = prevArtRef.current;
    const modeSwitchedToNext = prev.mode !== "next" && mode === "next";
    const albumChanged = prev.album !== album;
    if (modeSwitchedToNext && albumChanged) {
      setNextArt(art);
      setArtAnimating(true);
      const timeout = setTimeout(() => {
        setCurrentArt(art);
        setNextArt(null);
        setArtAnimating(false);
      }, 300);
      prevArtRef.current = { album, mode };
      return () => clearTimeout(timeout);
    }
    setCurrentArt(art);
    prevArtRef.current = { album, mode };
  }, [art, album, mode]);

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
      <div className="art-stack">
        <img
          src={currentArt}
          alt="Album art"
          className="album-art current"
          data-testid="current-art"
        />
        {nextArt && (
          <img
            src={nextArt}
            alt="Next album art"
            className={clsx("album-art next", artAnimating && "animating")}
            data-testid="next-art"
          />
        )}
      </div>
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
