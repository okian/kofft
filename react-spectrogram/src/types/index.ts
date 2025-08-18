// Audio and spectrogram types
export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  track?: number;
  genre?: string;
  comment?: string;
  composer?: string;
  album_artist?: string;
  disc?: number;
  total_tracks?: number;
  total_discs?: number;
  bitrate?: number;
  sample_rate?: number;
  channels?: number;
  bit_depth?: number;
  duration?: number;
  album_art?: Uint8Array;
  album_art_mime?: string;
  format?: string;
  format_description?: string;
}

// API Keys and external services
export interface APIKeys {
  acoustid?: string;
  musicbrainz?: string;
}

export interface APIKeyStatus {
  acoustid: { valid: boolean; lastChecked?: Date };
  musicbrainz: { valid: boolean; lastChecked?: Date };
}

// Artwork sources and results
export interface ArtworkSource {
  type: 'embedded' | 'musicbrainz' | 'acoustid' | 'filename' | 'placeholder';
  url?: string;
  data?: Uint8Array;
  mimeType?: string;
  confidence: number;
  metadata?: {
    artist?: string;
    album?: string;
    title?: string;
    mbid?: string;
  };
}

export interface ArtworkResult {
  success: boolean;
  artwork?: ArtworkSource;
  error?: string;
  sources: ArtworkSource[];
}

// MusicBrainz types
export interface MusicBrainzRelease {
  id: string;
  title: string;
  'artist-credit': Array<{
    name: string;
    artist?: {
      id: string;
      name: string;
    };
  }>;
  score: number;
}

export interface MusicBrainzResponse {
  releases: MusicBrainzRelease[];
}

// AcoustID types
export interface AcoustIDRecording {
  id: string;
  title: string;
  artists?: Array<{
    id: string;
    name: string;
  }>;
  releasegroups?: Array<{
    id: string;
    title: string;
    releases?: Array<{
      id: string;
      title: string;
    }>;
  }>;
}

export interface AcoustIDResult {
  id: string;
  recordings?: AcoustIDRecording[];
  score: number;
}

export interface AcoustIDResponse {
  results: AcoustIDResult[];
  status: string;
}

export interface AudioTrack {
  id: string;
  file: File;
  metadata: AudioMetadata;
  waveform?: number[];
  duration: number;
  url: string;
  artwork?: ArtworkSource;
  audioData?: Float32Array; // Audio buffer data for waveform generation
}

export interface SpectrogramSettings {
  theme: 'dark' | 'light' | 'neon' | 'high-contrast';
  amplitudeScale: 'linear' | 'logarithmic' | 'db';
  frequencyScale: 'linear' | 'logarithmic';
  resolution: 'low' | 'medium' | 'high';
  refreshRate: 30 | 60;
  colormap: string;
  showLegend: boolean;
  enableToastNotifications: boolean;
  // API Keys
  apiKeys: APIKeys;
  apiKeyStatus: APIKeyStatus;
  // Artwork settings
  enableExternalArtwork: boolean;
  enableAcoustID: boolean;
  enableMusicBrainz: boolean;
  enablePlaceholderArtwork: boolean;
}

export interface SpectrogramData {
  frequencies: number[];
  times: number[];
  intensities: number[][];
  colorMap: string[];
}

// UI State types
export interface UIState {
  metadataPanelOpen: boolean;
  playlistPanelOpen: boolean;
  settingsPanelOpen: boolean;
  isFullscreen: boolean;
  isMobile: boolean;
  isTablet: boolean;
}

// Audio State types
export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  currentTrack: AudioTrack | null;
  playlist: AudioTrack[];
  currentTrackIndex: number;
  isLive: boolean;
  isMicrophoneActive: boolean;
  inputDevice: string | null;
}

// Keyboard shortcuts
export interface KeyboardShortcuts {
  playPause: string;
  previousTrack: string;
  nextTrack: string;
  toggleMetadata: string;
  togglePlaylist: string;
  openSettings: string;
  snapshot: string;
  volumeUp: string;
  volumeDown: string;
  mute: string;
}

// WebGL and Canvas types
export interface CanvasSize {
  width: number;
  height: number;
}

export interface SpectrogramRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  vertexBuffer: WebGLBuffer;
  textureBuffer: WebGLBuffer;
  texture: WebGLTexture;
}

// Event types
export interface SpectrogramEvent {
  type: 'click' | 'hover' | 'drag';
  position: { x: number; y: number };
  frequency?: number;
  time?: number;
  intensity?: number;
}

// Component props types
export interface SpectrogramProps {
  data: SpectrogramData;
  settings: SpectrogramSettings;
  onEvent?: (event: SpectrogramEvent) => void;
  className?: string;
}

export interface AudioControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMute: () => void;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  waveform?: number[];
}

export interface MetadataPanelProps {
  track: AudioTrack | null;
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

export interface PlaylistPanelProps {
  tracks: AudioTrack[];
  currentTrackIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onTrackSelect: (index: number) => void;
  onTrackRemove: (index: number) => void;
  onTrackReorder: (fromIndex: number, toIndex: number) => void;
  isMobile?: boolean;
}

export interface SettingsPanelProps {
  settings: SpectrogramSettings;
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: Partial<SpectrogramSettings>) => void;
}

// Utility types
export type Theme = 'dark' | 'light' | 'neon' | 'high-contrast';
export type AmplitudeScale = 'linear' | 'logarithmic' | 'db';
export type FrequencyScale = 'linear' | 'logarithmic';
export type Resolution = 'low' | 'medium' | 'high';
export type RefreshRate = 30 | 60;

// WASM types
export interface WASMModule {
  extract_metadata: (fileData: Uint8Array, filename: string) => AudioMetadata;
  compute_spectrogram: (audioData: Float32Array, sampleRate: number) => SpectrogramData;
  compute_waveform: (audioData: Float32Array) => number[];
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Toast notification types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}
