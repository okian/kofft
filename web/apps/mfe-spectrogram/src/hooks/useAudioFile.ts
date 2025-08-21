import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioStore } from "@/shared/stores/audioStore";
import { audioPlayer, type AudioPlayerState } from "@/shared/utils/audioPlayer";
import { AudioTrack, AudioMetadata, ArtworkSource } from "@/types";
import {
  extractMetadata,
  generateAmplitudeEnvelope,
} from "@/shared/utils/wasm";
import { extractArtwork } from "@/shared/utils/artwork";
import { conditionalToast } from "@/shared/utils/toast";
import { metadataStore } from "@/shared/utils/metadataStore";
import {
  optimisticMetadataStore,
  computeOptimisticKey,
} from "@/shared/utils/optimisticMetadataStore";
import { metadataVerificationWorker } from "@/shared/utils/metadataVerificationWorker";

// Utility to compute SHA-256 hash for a file buffer
const hashArrayBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const useAudioFile = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const {
    setPlaying,
    setPaused,
    setStopped,
    setCurrentTime,
    setDuration,
    setVolume,
    setMuted,
    setCurrentTrack,
    addToPlaylist,
  } = useAudioStore();

  // Subscribe to audio player state changes
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((state: AudioPlayerState) => {
      setPlaying(state.isPlaying);
      setPaused(state.isPaused);
      setStopped(state.isStopped);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      setVolume(state.volume);
      setMuted(state.isMuted);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [
    setPlaying,
    setPaused,
    setStopped,
    setCurrentTime,
    setDuration,
    setVolume,
    setMuted,
  ]);

  // React to natural track endings by advancing the playlist according to
  // loop/shuffle preferences. This keeps playback continuity entirely within
  // the React layer and avoids tight coupling with the player engine.
  useEffect(() => {
    const unsubscribeEnded = audioPlayer.onTrackEnd(() => {
      const {
        playlist,
        currentTrackIndex,
        playTrack,
        setPlaying,
        setPaused,
        setStopped,
        loopMode,
        shuffle,
        nextTrack,
      } = useAudioStore.getState();

      const playlistLength = playlist.length;
      if (playlistLength === 0) {
        setPlaying(false);
        setPaused(false);
        setStopped(true);
        return;
      }

      if (loopMode === "one") {
        playTrack(currentTrackIndex);
        return;
      }

      if (shuffle) {
        if (playlistLength === 1 && loopMode === "off") {
          setPlaying(false);
          setPaused(false);
          setStopped(true);
        } else {
          // Delegate to store's shuffle-aware nextTrack implementation
          nextTrack();
        }
        return;
      }

      const isLastTrack = currentTrackIndex >= playlistLength - 1;
      if (!isLastTrack) {
        playTrack(currentTrackIndex + 1);
        return;
      }

      if (loopMode === "all") {
        playTrack(0);
        return;
      }

      setPlaying(false);
      setPaused(false);
      setStopped(true);
    });

    return () => {
      unsubscribeEnded();
    };
  }, []);

  // Parse metadata using WASM utility
  const parseMetadata = useCallback(
    async (file: File): Promise<AudioMetadata> => {
      try {
        return await extractMetadata(file);
      } catch (error) {
        return {
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          album: "Unknown Album",
          format: file.type || "unknown",
        };
      }
    },
    [],
  );

  // Generate amplitude envelope using WASM utility
  const generateAmplitudeEnvelopeData = useCallback(
    async (
      file: File,
      metadata: AudioMetadata,
      arrayBuffer?: ArrayBuffer,
    ): Promise<Float32Array> => {
      try {
        const sampleRate = metadata.sample_rate || 44100;

        // Use the shared audio context to decode audio data
        const context = await audioPlayer.initAudioContext();
        const buffer = arrayBuffer ?? (await file.arrayBuffer());
        const audioBuffer = await context.decodeAudioData(buffer);

        // Get first channel data
        const channelData = audioBuffer.getChannelData(0);
        const audioData = new Float32Array(channelData.length);
        audioData.set(channelData);

        // Generate envelope
        const envelope = await generateAmplitudeEnvelope(
          audioData,
          sampleRate,
          1000,
          20,
          3,
        );

        return envelope;
      } catch (error) {
        // Return empty array as fallback
        return new Float32Array(0);
      }
    },
    [],
  );

  // Start background verification for a track
  const startBackgroundVerification = useCallback(
    async (file: File, optimisticKey: string, trackId: string) => {
      try {
        const arrayBuffer = await file.arrayBuffer();

        // Add to verification queue with high priority for currently loaded tracks
        await metadataVerificationWorker.addVerificationTask(
          file.name,
          file.size,
          arrayBuffer,
          10, // High priority for currently loaded tracks
        );

        console.log(
          "🔄 [VERIFICATION] Added to verification queue:",
          optimisticKey,
        );

        // Set up a listener for verification completion
        const checkVerificationStatus = async () => {
          try {
            const result = await optimisticMetadataStore.getOptimisticMetadata(
              file.name,
              file.size,
            );
            if (result.metadata?.verified) {
              console.log(
                "✅ [VERIFICATION] Metadata verified for key:",
                optimisticKey,
              );

              // Update track with verified metadata
              const verifiedMetadata: AudioMetadata = {
                title: result.metadata.title,
                artist: result.metadata.artist,
                album: result.metadata.album,
                year: result.metadata.year,
                genre: result.metadata.genre,
                duration: result.metadata.duration,
                bitrate: result.metadata.bitrate,
                sample_rate: result.metadata.sample_rate,
                channels: result.metadata.channels,
                bit_depth: result.metadata.bit_depth,
                format: result.metadata.format,
                album_art: result.artwork?.data,
                album_art_mime:
                  result.artwork?.mime_type || result.metadata.album_art_mime,
              };

              let artwork: ArtworkSource | undefined;
              if (result.artwork) {
                artwork = {
                  type: "embedded",
                  data: result.artwork.data,
                  mimeType: result.artwork.mime_type,
                  confidence: 1.0,
                  metadata: {
                    artist: verifiedMetadata.artist,
                    album: verifiedMetadata.album,
                    title: verifiedMetadata.title,
                  },
                };
              }

              useAudioStore.getState().updateTrack(trackId, {
                metadata: verifiedMetadata,
                artwork,
              });

              conditionalToast.success(`Verified: ${verifiedMetadata.title}`);
              return true;
            }
          } catch (error) {
            console.warn(
              "⚠️ [VERIFICATION] Error checking verification status:",
              error,
            );
          }
          return false;
        };

        // Check verification status periodically
        const verificationInterval = setInterval(async () => {
          const verified = await checkVerificationStatus();
          if (verified) {
            clearInterval(verificationInterval);
          }
        }, 2000); // Check every 2 seconds

        // Stop checking after 30 seconds
        setTimeout(() => {
          clearInterval(verificationInterval);
        }, 30000);
      } catch (error) {
        console.error(
          "❌ [VERIFICATION] Failed to start background verification:",
          error,
        );
      }
    },
    [],
  );

  // Validate audio file
  const validateAudioFile = useCallback((file: File): boolean => {
    const validTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/flac",
      "audio/x-flac",
      "audio/ogg",
      "audio/oga",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
      "audio/webm",
      "audio/x-webm",
    ];

    return (
      validTypes.includes(file.type) ||
      !!file.name.match(/\.(mp3|wav|flac|ogg|m4a|aac|webm)$/i)
    );
  }, []);

  // Load single audio file with optimistic metadata
  const loadAudioFile = useCallback(
    async (file: File): Promise<AudioTrack> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!validateAudioFile(file)) {
          throw new Error("Invalid audio file format");
        }

        const id = crypto.randomUUID();
        const startTime = performance.now();

        // Create placeholder track for immediate UI feedback
        const placeholder: AudioTrack = {
          id,
          file,
          metadata: {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Loading...",
            album: "",
            duration: 0,
          },
          duration: 0,
          url: URL.createObjectURL(file),
          isLoading: true,
        };

        addToPlaylist(placeholder);

        const { playlist } = useAudioStore.getState();
        if (playlist.length === 1) {
          setCurrentTrack(placeholder);
        }

        // Fast path: Try optimistic metadata lookup
        const optimisticKey = computeOptimisticKey(file.name, file.size);
        console.log(
          "🚀 [OPTIMISTIC] Checking optimistic cache for key:",
          optimisticKey,
        );

        try {
          const optimisticResult =
            await optimisticMetadataStore.getOptimisticMetadata(
              file.name,
              file.size,
            );

          if (optimisticResult.metadata && optimisticResult.trackIndex) {
            const cacheHitTime = performance.now() - startTime;
            console.log(
              `⚡ [OPTIMISTIC] Cache hit in ${cacheHitTime.toFixed(2)}ms for key:`,
              optimisticKey,
            );

            // Convert optimistic metadata to AudioMetadata format
            const optimisticMetadata: AudioMetadata = {
              title: optimisticResult.metadata.title,
              artist: optimisticResult.metadata.artist,
              album: optimisticResult.metadata.album,
              year: optimisticResult.metadata.year,
              genre: optimisticResult.metadata.genre,
              duration: optimisticResult.metadata.duration,
              bitrate: optimisticResult.metadata.bitrate,
              sample_rate: optimisticResult.metadata.sample_rate,
              channels: optimisticResult.metadata.channels,
              bit_depth: optimisticResult.metadata.bit_depth,
              format: optimisticResult.metadata.format,
              album_art: optimisticResult.artwork?.data,
              album_art_mime:
                optimisticResult.artwork?.mime_type ||
                optimisticResult.metadata.album_art_mime,
            };

            // Create artwork source if available
            let artwork: ArtworkSource | undefined;
            if (optimisticResult.artwork) {
              artwork = {
                type: "embedded",
                data: optimisticResult.artwork.data,
                mimeType: optimisticResult.artwork.mime_type,
                confidence: optimisticResult.metadata.verified ? 1.0 : 0.8,
                metadata: {
                  artist: optimisticMetadata.artist,
                  album: optimisticMetadata.album,
                  title: optimisticMetadata.title,
                },
              };
            }

            // Update track with optimistic metadata immediately
            useAudioStore.getState().updateTrack(id, {
              metadata: optimisticMetadata,
              duration: optimisticMetadata.duration || 0,
              artwork,
              isLoading: false,
            });

            // Show verification status if not verified
            if (!optimisticResult.metadata.verified) {
              conditionalToast.info(
                `Loaded: ${optimisticMetadata.title} (verifying...)`,
              );
            } else {
              conditionalToast.success(`Loaded: ${optimisticMetadata.title}`);
            }

            // Start background verification if not already verified
            if (!optimisticResult.metadata.verified) {
              startBackgroundVerification(file, optimisticKey, id);
            }

            return placeholder;
          }
        } catch (optimisticError) {
          console.warn(
            "⚠️ [OPTIMISTIC] Optimistic lookup failed, falling back to full extraction:",
            optimisticError,
          );
        }

        // Fallback: Full metadata extraction
        console.log(
          "🔍 [METADATA] No optimistic cache hit, performing full extraction...",
        );
        (async () => {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const hash = await hashArrayBuffer(arrayBuffer);
            let metadata: AudioMetadata;
            let artwork: ArtworkSource | undefined;

            // Try to get cached metadata from IndexedDB (legacy fallback)
            try {
              const cachedMetadata = await metadataStore.getMetadata(hash);
              if (cachedMetadata) {
                console.log("📦 [METADATA] Found cached metadata in IndexedDB");

                // Convert stored metadata back to AudioMetadata format
                metadata = {
                  title: cachedMetadata.title,
                  artist: cachedMetadata.artist,
                  album: cachedMetadata.album,
                  year: cachedMetadata.year,
                  genre: cachedMetadata.genre || "",
                  duration: cachedMetadata.duration,
                  bitrate: cachedMetadata.bitrate,
                  sample_rate: cachedMetadata.sample_rate,
                  channels: cachedMetadata.channels,
                  bit_depth: cachedMetadata.bit_depth,
                  format: cachedMetadata.format,
                  album_art: undefined, // Will be loaded separately if needed
                  album_art_mime: cachedMetadata.album_art_mime,
                };

                // Load album art if available
                if (cachedMetadata.album_art_hash) {
                  const albumArt = await metadataStore.getAlbumArt(
                    cachedMetadata.album_art_hash,
                  );
                  if (albumArt) {
                    metadata.album_art = albumArt.data;
                    metadata.album_art_mime = albumArt.mime_type;

                    // Create artwork source for UI
                    artwork = {
                      type: "embedded",
                      data: albumArt.data,
                      mimeType: albumArt.mime_type,
                      confidence: 1.0,
                      metadata: {
                        artist: metadata.artist,
                        album: metadata.album,
                        title: metadata.title,
                      },
                    };
                  }
                }
              } else {
                // No cached metadata, extract it
                console.log(
                  "🔍 [METADATA] No cached metadata found, extracting...",
                );
                metadata = await parseMetadata(file);
                const artworkResult = await extractArtwork(
                  metadata,
                  file.name,
                  arrayBuffer,
                );
                artwork = artworkResult.artwork;

                // Store in both legacy and optimistic stores
                try {
                  console.log("💾 [METADATA] Storing metadata in IndexedDB...");
                  const { metadataId, albumArtId } =
                    await metadataStore.storeMetadata(
                      file,
                      metadata,
                      arrayBuffer,
                    );
                  console.log("✅ [METADATA] Metadata stored successfully:", {
                    metadataId,
                    albumArtId,
                  });

                  // Also store in optimistic cache
                  await optimisticMetadataStore.storeOptimisticMetadata(
                    file.name,
                    file.size,
                    metadata,
                    arrayBuffer,
                  );
                  console.log(
                    "✅ [OPTIMISTIC] Metadata stored in optimistic cache",
                  );
                } catch (storeError) {
                  console.error(
                    "❌ [METADATA] Failed to store metadata:",
                    storeError,
                  );
                  // Continue without storing - metadata is still available for this session
                }
              }
            } catch (dbError) {
              console.error(
                "❌ [METADATA] IndexedDB error, falling back to extraction:",
                dbError,
              );
              // Fallback to extraction if IndexedDB fails
              metadata = await parseMetadata(file);
              const artworkResult = await extractArtwork(
                metadata,
                file.name,
                arrayBuffer,
              );
              artwork = artworkResult.artwork;

              // Store in optimistic cache
              try {
                await optimisticMetadataStore.storeOptimisticMetadata(
                  file.name,
                  file.size,
                  metadata,
                  arrayBuffer,
                );
              } catch (optimisticError) {
                console.warn(
                  "⚠️ [OPTIMISTIC] Failed to store in optimistic cache:",
                  optimisticError,
                );
              }
            }

            const audioData = await generateAmplitudeEnvelopeData(
              file,
              metadata,
              arrayBuffer,
            );

            useAudioStore.getState().updateTrack(id, {
              metadata: {
                title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
                artist: metadata.artist || "Unknown Artist",
                album: metadata.album || "Unknown Album",
                year: metadata.year
                  ? parseInt(metadata.year.toString())
                  : undefined,
                genre: metadata.genre || "",
                duration: metadata.duration || 0,
                bitrate: metadata.bitrate || 0,
                sample_rate: metadata.sample_rate || 0,
                channels: metadata.channels || 0,
                album_art: metadata.album_art,
                album_art_mime: metadata.album_art_mime,
              },
              duration: metadata.duration || 0,
              audioData,
              artwork,
              isLoading: false,
            });

            const totalTime = performance.now() - startTime;
            console.log(
              `✅ [METADATA] Full extraction completed in ${totalTime.toFixed(2)}ms`,
            );
            conditionalToast.success(
              `Loaded: ${metadata.title || file.name.replace(/\.[^/.]+$/, "")}`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to load audio file";
            setError(errorMessage);
            conditionalToast.error(errorMessage);
            useAudioStore.getState().updateTrack(id, { isLoading: false });
          }
        })();

        return placeholder;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load audio file";
        setError(errorMessage);
        conditionalToast.error(errorMessage);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [
      validateAudioFile,
      parseMetadata,
      generateAmplitudeEnvelopeData,
      addToPlaylist,
      setCurrentTrack,
      startBackgroundVerification,
    ],
  );

  // Load multiple audio files
  const loadAudioFiles = useCallback(
    async (files: FileList | File[]): Promise<AudioTrack[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(validateAudioFile);
        const invalidFiles = fileArray.filter(
          (file) => !validateAudioFile(file),
        );

        if (validFiles.length === 0) {
          throw new Error("No valid audio files found");
        }

        const results = await Promise.all(
          validFiles.map(async (file) => {
            try {
              return await loadAudioFile(file);
            } catch {
              return null;
            }
          }),
        );

        const tracks = results.filter((t): t is AudioTrack => t !== null);

        if (tracks.length > 0) {
          const { currentTrack } = useAudioStore.getState();
          if (!currentTrack) {
            setCurrentTrack(tracks[0]);
          }
        }

        const successMessage = `Loaded ${tracks.length} audio file${tracks.length > 1 ? "s" : ""}`;
        if (invalidFiles.length > 0) {
          conditionalToast.success(
            `${successMessage} (${invalidFiles.length} skipped)`,
          );
        } else {
          conditionalToast.success(successMessage);
        }

        return tracks;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load audio files";
        setError(errorMessage);
        conditionalToast.error(errorMessage);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [validateAudioFile, loadAudioFile, setCurrentTrack],
  );

  // Play audio track
  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      await audioPlayer.playTrack(track);
    } catch (error) {
      conditionalToast.error("Failed to play audio track");
      throw error;
    }
  }, []);

  // Stop playback
  const stopPlayback = useCallback(() => {
    audioPlayer.stopPlayback();
  }, []);

  // Pause playback
  const pausePlayback = useCallback(() => {
    audioPlayer.pausePlayback();
  }, []);

  // Resume playback
  const resumePlayback = useCallback(() => {
    audioPlayer.resumePlayback();
  }, []);

  // Seek to position
  const seekTo = useCallback((time: number) => {
    audioPlayer.seekTo(time);
  }, []);

  // Set volume
  const setAudioVolume = useCallback((volume: number) => {
    audioPlayer.setVolume(volume);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    audioPlayer.toggleMute();
  }, []);

  // Get frequency data for spectrogram
  const getFrequencyData = useCallback(() => {
    return audioPlayer.getFrequencyData();
  }, []);

  // Get time domain data
  const getTimeData = useCallback(() => {
    return audioPlayer.getTimeData();
  }, []);

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    return await audioPlayer.initAudioContext();
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    audioPlayer.cleanup();
  }, []);

  return {
    isLoading,
    error,
    loadAudioFile,
    loadAudioFiles,
    playTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    seekTo,
    setAudioVolume,
    toggleMute,
    getFrequencyData,
    getTimeData,
    cleanup,
    initAudioContext,
    startBackgroundVerification,
  };
};
