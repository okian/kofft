import React from "react";
import { MARQUEE_DELAY_MS } from "@/shared/config";
import { cn } from "@/shared/utils/cn";
import { useMarquee } from "@/shared/hooks/useMarquee";

interface MarqueeTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  className?: string;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className,
  ...spanProps
}) => {
  const ref = useMarquee<HTMLSpanElement>({ delay: MARQUEE_DELAY_MS, text });
  return (
    <div className="marquee-container" aria-label={text}>
      <span
        ref={ref}
        data-text={text}
        className={cn("marquee-text", className)}
        {...spanProps}
      >
        {text}
      </span>
    </div>
  );
};

export default MarqueeText;
