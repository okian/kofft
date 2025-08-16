import React, { useRef, useEffect } from "react";

interface Props {
  pixels?: Uint8ClampedArray;
  width: number;
  height: number;
}

export function SpectrogramCanvas({ pixels, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels || width === 0 || height === 0) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = new ImageData(pixels, width, height);
    ctx.putImageData(image, 0, 0);
  }, [pixels, width, height]);

  return <canvas ref={canvasRef} className="spectrogram" />;
}
