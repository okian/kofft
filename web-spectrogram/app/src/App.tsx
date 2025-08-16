import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SpectrogramCanvas } from "./components/SpectrogramCanvas";
import { PlaybackControls } from "./components/PlaybackControls";
import { extractMetadata, TrackMetadata } from "./utils/metadata";
import { SpectrogramData, generateSpectrogram } from "./utils/spectrogram";

export default function App() {
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const [playing, setPlaying] = useState(false);
  const [spec, setSpec] = useState<SpectrogramData | null>(null);

  async function handleFile(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];
    const md = await extractMetadata(file);
    setMetadata(md);
    const s = await generateSpectrogram(file);
    setSpec(s);
  }

  return (
    <div className="app">
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => handleFile(e.target.files)}
      />
      <Sidebar metadata={metadata} />
      <SpectrogramCanvas
        pixels={spec?.pixels}
        width={spec?.width ?? 0}
        height={spec?.height ?? 0}
      />
      <PlaybackControls
        playing={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
