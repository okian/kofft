import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface AlternatingInfoProps {
  artist: string;
  album: string;
  /** Interval in milliseconds to switch between artist and album */
  interval?: number;
  className?: string;
}

export const AlternatingInfo: React.FC<AlternatingInfoProps> = ({
  artist,
  album,
  interval = 4000,
  className,
}) => {
  const [showArtist, setShowArtist] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const switchInfo = () => {
      setShowArtist((prev) => !prev);
      timeout = setTimeout(switchInfo, interval);
    };
    timeout = setTimeout(switchInfo, interval);
    return () => clearTimeout(timeout);
  }, [interval]);

  const checkOverflow = () => {
    const container = containerRef.current;
    const span = container?.firstElementChild as HTMLElement | null;
    if (container && span) {
      setIsOverflow(span.scrollWidth > container.clientWidth);
    }
  };

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
    // Depend on values that can change text size
  }, [artist, album, showArtist]);

  const content = showArtist ? artist : album;
  const fallback = showArtist ? "Unknown Artist" : "Unknown Album";
  const displayText = content || fallback;

  return (
    <div ref={containerRef} className="relative min-w-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={showArtist ? "artist" : "album"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={cn(
            className,
            "block",
            isOverflow ? "marquee" : "truncate",
          )}
          data-testid="alternating-info-text"
        >
          {displayText}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default AlternatingInfo;
