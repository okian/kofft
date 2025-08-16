import React from "react";

interface Props {
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export function PlaybackControls({ playing, onPlay, onPause }: Props) {
  return (
    <div className="controls">
      {playing ? (
        <button onClick={onPause}>Pause</button>
      ) : (
        <button onClick={onPlay}>Play</button>
      )}
    </div>
  );
}
