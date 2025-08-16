import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SpectrogramCanvas } from "./components/SpectrogramCanvas";
import { PlaybackControls } from "./components/PlaybackControls";
import { extractMetadata, TrackMetadata } from "./utils/metadata";

export default function App() {
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const [playing, setPlaying] = useState(false);

  async function handleFile(files: FileList | null) {
    if (!files?.[0]) return;
    const md = await extractMetadata(files[0]);
    setMetadata(md);
    // TODO: load audio and render spectrogram
  }

  return (
    <div className="app">
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => handleFile(e.target.files)}
      />
      <Sidebar metadata={metadata} />
      <SpectrogramCanvas />
      <PlaybackControls
        playing={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
