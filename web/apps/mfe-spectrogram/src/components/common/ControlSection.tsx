import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

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

/**
 * Renders album art with song information using a WebGL scene backed by
 * pixi.js. If WebGL initialization fails, falls back to a 2D canvas.
 */
export function ControlSection({
  art,
  title,
  artist,
  album,
  mode,
}: ControlSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let app: PIXI.Application | null = null;
    try {
      app = new PIXI.Application({
        view: canvas,
        width: 300,
        height: 150,
        backgroundAlpha: 0,
      });
      canvas.dataset.renderer = "webgl";

      app.stage.removeChildren();

      const sprite = PIXI.Sprite.from(art);
      sprite.width = 216; // Increased by 1 rem (16px)
      sprite.height = 216; // Increased by 1 rem (16px)
      sprite.x = 0;
      sprite.y = 17; // Adjusted y position to center the larger art
      app.stage.addChild(sprite);

      const titleText = new PIXI.Text(title, {
        fill: 0xffffff,
        fontSize: 16,
      });
      titleText.x = 110;
      titleText.y = 20;
      app.stage.addChild(titleText);

      const meta = mode === "now" ? `${artist} • ${album}` : "Coming Up Next";
      const metaText = new PIXI.Text(meta, {
        fill: 0xffffff,
        fontSize: 12,
      });
      metaText.x = 110;
      metaText.y = 50;
      app.stage.addChild(metaText);
    } catch (err) {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      canvas.dataset.renderer = "2d";
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 17, 116, 116); // Increased by 1 rem (16px) and adjusted y position
        ctx.fillStyle = "white";
        ctx.font = "16px sans-serif";
        ctx.fillText(title, 110, 20);
        ctx.font = "12px sans-serif";
        const meta = mode === "now" ? `${artist} • ${album}` : "Coming Up Next";
        ctx.fillText(meta, 110, 50);
      };
      img.src = art;
    }

    return () => {
      app?.destroy(true, { children: true });
    };
  }, [art, title, artist, album, mode]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={150}
      data-testid="control-section"
    />
  );
}

export default ControlSection;
