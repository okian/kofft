import React, { useRef, useEffect } from "react";

export function SpectrogramCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Placeholder for WASM spectrogram drawing
  }, []);

  return <canvas ref={canvasRef} className="spectrogram" />;
}
