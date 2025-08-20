import { AudioTrack, AudioMetadata } from "@/types";
import { extractMetadata, resampleAudio } from "./wasm";

export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/flac",
  "audio/ogg",
  "audio/oga",
  "audio/webm",
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a",
];

export function isAudioFile(file: File): boolean {
  return (
    SUPPORTED_AUDIO_FORMATS.includes(file.type) ||
    file.name.match(/\.(mp3|wav|flac|ogg|webm|aac|m4a)$/i) !== null
  );
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function generateTrackId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createAudioTrack(
  file: File,
  metadata: AudioMetadata,
): AudioTrack {
  return {
    id: generateTrackId(),
    file,
    metadata,
    duration: metadata.duration || 0,
    url: URL.createObjectURL(file),
  };
}

export function revokeTrackUrl(track: AudioTrack): void {
  if (track.url && track.url.startsWith("blob:")) {
    URL.revokeObjectURL(track.url);
  }
}

export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  return await extractMetadata(file);
}

export function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices
    .enumerateDevices()
    .then((devices) =>
      devices.filter((device) => device.kind === "audioinput"),
    );
}

export async function requestMicrophonePermission(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    return null;
  }
}

export function decodeAudioData(
  audioContext: AudioContext,
  arrayBuffer: ArrayBuffer,
): Promise<AudioBuffer> {
  return audioContext.decodeAudioData(arrayBuffer);
}

export function getAudioBufferData(audioBuffer: AudioBuffer): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  return new Float32Array(channelData);
}

export async function resampleAudioData(
  audioData: Float32Array,
  targetSampleRate: number,
  originalSampleRate: number,
): Promise<Float32Array> {
  const wasmResult = await resampleAudio(
    audioData,
    originalSampleRate,
    targetSampleRate,
  );
  if (wasmResult) return wasmResult;
  return resampleAudioDataFallback(
    audioData,
    targetSampleRate,
    originalSampleRate,
  );
}

export function resampleAudioDataFallback(
  audioData: Float32Array,
  targetSampleRate: number,
  originalSampleRate: number,
): Float32Array {
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const resampled = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const index = i * ratio;
    const i0 = Math.floor(index);
    const frac = index - i0;
    const s0 = audioData[i0] || 0;
    const s1 = audioData[i0 + 1] || s0;
    resampled[i] = s0 + (s1 - s0) * frac;
  }

  return resampled;
}
