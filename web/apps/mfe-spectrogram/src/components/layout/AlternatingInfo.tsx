import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/utils/cn";
import { MarqueeText } from "@/features/playback/MarqueeText";

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
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const switchInfo = () => {
      setShowArtist((prev) => !prev);
      timeout = setTimeout(switchInfo, interval);
    };
    timeout = setTimeout(switchInfo, interval);
    return () => clearTimeout(timeout);
  }, [interval]);

  const content = showArtist ? artist : album;
  const fallback = showArtist ? "Unknown Artist" : "Unknown Album";
  const displayText = content || fallback;

  return (
    <div className="relative min-w-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={showArtist ? "artist" : "album"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <MarqueeText
            text={displayText}
            className={cn(className, "block")}
            data-testid="alternating-info-text"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AlternatingInfo;
