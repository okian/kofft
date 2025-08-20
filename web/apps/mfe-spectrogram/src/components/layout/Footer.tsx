import React, { useRef, useCallback, useMemo } from "react";
import { useAudioStore } from "@/shared/stores/audioStore";
import { useAudioFile } from "@/shared/hooks/useAudioFile";
import { useScreenSize } from "@/shared/hooks/useScreenSize";
import { CanvasWaveformSeekbar } from "@/features/spectrogram/CanvasWaveformSeekbar";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  FileAudio,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { conditionalToast } from "@/shared/utils/toast";
import { AlternatingInfo } from "./AlternatingInfo";
import { MarqueeText } from "@/features/playback/MarqueeText";
import {
  TITLE_FONT_STEP,
  INFO_MAX_CH,
  NEXT_WINDOW_SEC,
  SIZE_SWAP_DURATION_MS,
} from "@/shared/config";

export const Footer: React.FC = () => {
  const volumeSliderRef = useRef<HTMLInputElement>(null);

  const {
    isPlaying,
    isStopped,
    currentTime,
    duration,
    volume,
    isMuted,
    currentTrack,
    playlist,
    currentTrackIndex,
    shuffle,
    loopMode,
    setShuffle,
    setLoopMode,
    nextTrack: nextTrackAction,
    previousTrack: previousTrackAction,
  } = useAudioStore();

  const { isMobile, isTablet } = useScreenSize();
  const audioFile = useAudioFile();

  const hasUpcomingTrack =
    currentTrackIndex >= 0 && currentTrackIndex < playlist.length - 1;
  const upcomingTrack = hasUpcomingTrack
    ? playlist[currentTrackIndex + 1]
    : null;
  const showNextInfo =
    !!currentTrack &&
    hasUpcomingTrack &&
    duration - currentTime <= NEXT_WINDOW_SEC;

  const upcomingTrackInfo = useMemo(() => {
    if (!currentTrack || !upcomingTrack) return "";

    const song = upcomingTrack.metadata.title || upcomingTrack.file.name;
    const currentArtist = currentTrack.metadata.artist;
    const currentAlbum = currentTrack.metadata.album;
    const upcomingArtist = upcomingTrack.metadata.artist;
    const upcomingAlbum = upcomingTrack.metadata.album;

    const normalize = (s?: string | null) => s?.trim().toLowerCase() ?? "";
    const normalizeAlbum = (s?: string | null) =>
      normalize(
        s
          ?.replace(/\((?:deluxe|special|expanded|remastered)[^)]*\)/gi, "")
          ?.replace(/\[(?:deluxe|special|expanded|remastered)[^\]]*\]/gi, "")
          ?.replace(/-(?:deluxe|special|expanded|remastered)[^-]*$/gi, ""),
      );

    const nSong = normalize(song);
    const nCurrentArtist = normalize(currentArtist);
    const nCurrentAlbum = normalizeAlbum(currentAlbum);
    const nUpcomingArtist = normalize(upcomingArtist);
    const nUpcomingAlbum = normalizeAlbum(upcomingAlbum);

    const sameArtist =
      nCurrentArtist && nUpcomingArtist && nCurrentArtist === nUpcomingArtist;
    const sameAlbum =
      nCurrentAlbum && nUpcomingAlbum && nCurrentAlbum === nUpcomingAlbum;

    if (
      (nSong && nSong === nUpcomingArtist) ||
      (nSong && nSong === nUpcomingAlbum)
    ) {
      return song;
    }

    if (sameArtist) {
      if (sameAlbum) return song;
      if (upcomingAlbum) return `${song} from ${upcomingAlbum}`;
      return song;
    }

    if (upcomingArtist) return `${song} by ${upcomingArtist}`;
    if (upcomingAlbum) return `${song} from ${upcomingAlbum}`;
    return song;
  }, [currentTrack, upcomingTrack]);

  const trackInfoStyle = {
    width: `min(100%, ${INFO_MAX_CH}ch)`,
    "--base-title-size": isMobile ? "0.75rem" : "0.875rem",
    "--title-font-step": `${TITLE_FONT_STEP}rem`,
    "--size-swap-duration": `${SIZE_SWAP_DURATION_MS}ms`,
  } as React.CSSProperties;

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle volume change
  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(event.target.value) / 100;
      audioFile.setAudioVolume(newVolume);
    },
    [audioFile],
  );

  // Toggle mute
  const toggleMute = useCallback(() => {
    audioFile.toggleMute();
  }, [audioFile]);

  const toggleShuffle = useCallback(() => {
    setShuffle(!shuffle);
  }, [shuffle, setShuffle]);

  const toggleLoopMode = useCallback(() => {
    const next =
      loopMode === "off" ? "all" : loopMode === "all" ? "one" : "off";
    setLoopMode(next);
  }, [loopMode, setLoopMode]);

  // Transport controls
  const togglePlayPause = useCallback(() => {
    if (isStopped) {
      if (currentTrack) {
        audioFile.playTrack(currentTrack);
      } else {
        conditionalToast.error("No audio file loaded");
      }
    } else if (isPlaying) {
      audioFile.pausePlayback();
    } else {
      audioFile.resumePlayback();
    }
  }, [isStopped, isPlaying, currentTrack, audioFile]);

  const stopPlayback = useCallback(() => {
    audioFile.stopPlayback();
  }, [audioFile]);

  const previousTrack = useCallback(() => {
    previousTrackAction();
  }, [previousTrackAction]);

  const nextTrack = useCallback(() => {
    nextTrackAction();
  }, [nextTrackAction]);

  // Determine layout configuration based on screen size
  const layoutConfig = useMemo(() => {
    if (isMobile) {
      return {
        showAlbumArt: false,
        showTrackInfo: true,
        showTimeDisplay: true,
        showVolumeControl: true,
        showAdditionalControls: false,
        buttonSize: 20,
        playButtonSize: 24,
        footerHeight: "h-16",
      };
    } else if (isTablet) {
      return {
        showAlbumArt: true,
        showTrackInfo: true,
        showTimeDisplay: true,
        showVolumeControl: true,
        showAdditionalControls: true,
        buttonSize: 18,
        playButtonSize: 22,
        footerHeight: "h-14",
      };
    } else {
      return {
        showAlbumArt: true,
        showTrackInfo: true,
        showTimeDisplay: true,
        showVolumeControl: true,
        showAdditionalControls: true,
        buttonSize: 20,
        playButtonSize: 24,
        footerHeight: "h-14",
      };
    }
  }, [isMobile, isTablet]);

  // Render album art for current track
  const renderCurrentTrackAlbumArt = () => {
    if (!layoutConfig.showAlbumArt) return null;

    // Use the new artwork system if available
    if (
      currentTrack?.artwork &&
      currentTrack.artwork.data &&
      currentTrack.artwork.data.length > 0
    ) {
      try {
        const artworkData = currentTrack.artwork.data;
        const mimeType = currentTrack.artwork.mimeType || "image/jpeg";

        // Validate the data before creating blob
        if (artworkData.length < 100) {
          console.warn(
            "Album art data too small, likely invalid:",
            artworkData.length,
            "bytes",
          );
          return renderFallbackAlbumArt();
        }

        // Create blob from the Uint8Array
        const blob = new Blob([artworkData], { type: mimeType });
        const url = URL.createObjectURL(blob);

        return (
          <img
            src={url}
            alt="Album Art"
            className={cn(
              "object-cover rounded flex-shrink-0",
              isMobile ? "w-8 h-8" : "w-10 h-10",
            )}
            onLoad={() => {
              // Clean up the URL after the image loads
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            onError={(e) => {
              // Clean up the URL on error
              URL.revokeObjectURL(url);
              // Hide the failed image
              const imgElement = e.currentTarget as HTMLImageElement;
              imgElement.style.display = "none";
            }}
          />
        );
      } catch (error) {
        return renderFallbackAlbumArt();
      }
    }

    // Fallback to old metadata album art if available
    if (
      currentTrack?.metadata.album_art &&
      currentTrack.metadata.album_art.length > 0
    ) {
      try {
        const albumArtData = currentTrack.metadata.album_art;
        const mimeType = currentTrack.metadata.album_art_mime || "image/jpeg";

        // Validate the data before creating blob
        if (albumArtData.length < 100) {
          return renderFallbackAlbumArt();
        }

        // Create blob from the Uint8Array
        const blob = new Blob([albumArtData], { type: mimeType });
        const url = URL.createObjectURL(blob);

        return (
          <img
            src={url}
            alt="Album Art"
            className={cn(
              "object-cover rounded flex-shrink-0",
              isMobile ? "w-8 h-8" : "w-10 h-10",
            )}
            onLoad={() => {
              // Clean up the URL after the image loads
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            onError={(e) => {
              // Clean up the URL on error
              URL.revokeObjectURL(url);
              // Hide the failed image
              const imgElement = e.currentTarget as HTMLImageElement;
              imgElement.style.display = "none";
            }}
          />
        );
      } catch (error) {
        return renderFallbackAlbumArt();
      }
    }

    // Fallback album art placeholder
    return renderFallbackAlbumArt();
  };

  const renderFallbackAlbumArt = () => (
    <div
      className={cn(
        "bg-neutral-800 rounded flex-shrink-0 flex items-center justify-center",
        isMobile ? "w-8 h-8" : "w-10 h-10",
      )}
    >
      <FileAudio size={isMobile ? 14 : 16} className="text-neutral-500" />
    </div>
  );

  return (
    <footer
      className={cn("footer-controls", layoutConfig.footerHeight)}
      data-testid="footer"
      role="contentinfo"
      aria-label="Playback controls"
    >
      {/* Single row layout with all controls */}
      <div className="flex items-center justify-between w-full h-full px-4 gap-3">
        {/* Left side - Album art and track info */}
        <div className="flex items-center gap-2 min-w-0">
          {layoutConfig.showAlbumArt && renderCurrentTrackAlbumArt()}

          {layoutConfig.showTrackInfo && currentTrack && (
            <div
              className={cn("track-info-area", showNextInfo && "next-active")}
              data-testid="track-info-area"
              style={trackInfoStyle}
            >
              <MarqueeText
                text={currentTrack.metadata.title || currentTrack.file.name}
                className="track-title font-medium text-neutral-100"
              />
              {showNextInfo && upcomingTrack ? (
                <MarqueeText
                  text={`Coming up: ${upcomingTrackInfo}`}
                  className="next-info text-neutral-400"
                  data-testid="upcoming-track-info"
                />
              ) : (
                <AlternatingInfo
                  artist={currentTrack.metadata.artist || "Unknown Artist"}
                  album={currentTrack.metadata.album || "Unknown Album"}
                  className="text-neutral-400"
                />
              )}
            </div>
          )}
        </div>

        {/* Center - Transport controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Previous track */}
          <button
            onClick={previousTrack}
            disabled={playlist.length === 0}
            className={cn(
              "rounded transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-w-[32px] min-h-[32px] flex items-center justify-center",
              "p-1",
            )}
            title="Previous track (Ctrl+←)"
            data-testid="previous-track-button"
            aria-label="Previous track"
          >
            <SkipBack size={layoutConfig.buttonSize} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            disabled={!currentTrack && !isPlaying}
            className={cn(
              "rounded-full transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-w-[40px] min-h-[40px] flex items-center justify-center",
              "p-2",
            )}
            title="Play/Pause (Space)"
            data-testid="play-pause-button"
            aria-label={isPlaying ? "Pause playback" : "Start playback"}
          >
            {isPlaying ? (
              <Pause
                size={layoutConfig.playButtonSize}
                data-testid="play-pause-icon"
                data-state="playing"
              />
            ) : (
              <Play
                size={layoutConfig.playButtonSize}
                data-testid="play-pause-icon"
                data-state="paused"
              />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stopPlayback}
            disabled={isStopped}
            className={cn(
              "rounded transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-w-[32px] min-h-[32px] flex items-center justify-center",
              "p-1",
            )}
            title="Stop"
            data-testid="stop-button"
            aria-label="Stop playback"
          >
            <Square size={layoutConfig.buttonSize} />
          </button>

          {/* Next track */}
          <button
            onClick={nextTrack}
            disabled={playlist.length === 0}
            className={cn(
              "rounded transition-colors duration-200",
              "hover:bg-neutral-800 active:bg-neutral-700",
              "text-neutral-400 hover:text-neutral-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-w-[32px] min-h-[32px] flex items-center justify-center",
              "p-1",
            )}
            title="Next track (Ctrl+→)"
            data-testid="next-track-button"
            aria-label="Next track"
          >
            <SkipForward size={layoutConfig.buttonSize} />
          </button>
        </div>

        {/* Right side - Time, volume, and additional controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Time display */}
          {layoutConfig.showTimeDisplay && (
            <div className="flex items-center gap-1 text-xs text-neutral-400 flex-shrink-0">
              <span data-testid="current-time">{formatTime(currentTime)}</span>
              <span>/</span>
              <span data-testid="total-duration">{formatTime(duration)}</span>
            </div>
          )}

          {/* Additional controls */}
          {layoutConfig.showAdditionalControls && (
            <div className="flex items-center gap-1">
              <button
                data-testid="shuffle-button"
                className={cn(
                  "p-1 rounded transition-colors duration-200",
                  "hover:bg-neutral-800 active:bg-neutral-700",
                  "text-neutral-400 hover:text-neutral-200",
                  "min-w-[28px] min-h-[28px] flex items-center justify-center",
                  shuffle && "text-neutral-200 bg-neutral-700",
                )}
                title={shuffle ? "Disable shuffle" : "Enable shuffle"}
                aria-label="Shuffle playlist"
                aria-pressed={shuffle}
                onClick={toggleShuffle}
              >
                <Shuffle size={16} />
              </button>

              <button
                data-testid="repeat-button"
                className={cn(
                  "p-1 rounded transition-colors duration-200",
                  "hover:bg-neutral-800 active:bg-neutral-700",
                  "text-neutral-400 hover:text-neutral-200",
                  "min-w-[28px] min-h-[28px] flex items-center justify-center",
                  loopMode !== "off" && "text-neutral-200 bg-neutral-700",
                )}
                title={
                  loopMode === "one"
                    ? "Repeat current track"
                    : loopMode === "all"
                      ? "Repeat playlist"
                      : "Repeat off"
                }
                aria-label="Repeat playlist"
                aria-pressed={loopMode !== "off"}
                onClick={toggleLoopMode}
              >
                {loopMode === "one" ? (
                  <Repeat1 size={16} />
                ) : (
                  <Repeat size={16} />
                )}
              </button>
            </div>
          )}

          {/* Volume control */}
          {layoutConfig.showVolumeControl && (
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                className={cn(
                  "p-1 rounded transition-colors duration-200",
                  "hover:bg-neutral-800 active:bg-neutral-700",
                  "text-neutral-400 hover:text-neutral-200",
                  "min-w-[28px] min-h-[28px] flex items-center justify-center",
                )}
                title="Mute/Unmute"
                data-testid="mute-button"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>

              <div className={isMobile ? "w-12" : "w-16"}>
                <input
                  ref={volumeSliderRef}
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume * 100}
                  onChange={handleVolumeChange}
                  className={cn(
                    "w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer",
                    "slider-thumb:appearance-none slider-thumb:w-3 slider-thumb:h-3",
                    "slider-thumb:bg-neutral-300 slider-thumb:rounded-full",
                    "slider-thumb:cursor-pointer slider-thumb:border-0",
                    "hover:slider-thumb:bg-neutral-200",
                  )}
                  title="Volume"
                  data-testid="volume-slider"
                  aria-label="Volume control"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Waveform Seekbar - Full width below controls */}
      <div className="flex-1 px-4 pb-2">
        <CanvasWaveformSeekbar
          audioData={currentTrack?.audioData || null}
          currentTime={currentTime}
          duration={duration}
          onSeek={(time) => {
            audioFile.seekTo(time);
            if (!isPlaying) {
              if (isStopped && currentTrack) {
                audioFile.playTrack(currentTrack);
              } else {
                audioFile.resumePlayback();
              }
            }
          }}
          numBars={isMobile ? 150 : 300}
          barWidth={isMobile ? 1 : 2}
          barGap={isMobile ? 0.5 : 1}
          maxBarHeight={isMobile ? 16 : 24}
          disabled={!currentTrack}
          bufferedTime={duration * 0.8} // Mock buffered time for demo
        />
      </div>
    </footer>
  );
};
