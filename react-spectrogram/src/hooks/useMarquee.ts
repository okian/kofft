import { useEffect, useRef } from "react";
import {
  MARQUEE_DURATION_MULTIPLIER,
  MARQUEE_MIN_DURATION,
  PREFERS_REDUCED_MOTION,
} from "@/config";

interface UseMarqueeOptions {
  /** Delay before starting marquee */
  delay: number;
  /** Content string used to recalc width on change */
  text: string;
}

/**
 * Hook to add marquee animation to overflowing text.
 * Adds `marquee-active` class to the element after the delay when overflow occurs.
 * Removes animation on cleanup or when text fits.
 */
export function useMarquee<T extends HTMLElement>({
  delay,
  text,
}: UseMarqueeOptions) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    const container = el?.parentElement;
    if (!el || !container) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      if (!el || !container) return;
      const overflow = el.scrollWidth > container.clientWidth;
      el.classList.remove("marquee-active");
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (overflow && !PREFERS_REDUCED_MOTION) {
        const duration = Math.max(
          (el.scrollWidth / container.clientWidth) *
            MARQUEE_DURATION_MULTIPLIER,
          MARQUEE_MIN_DURATION,
        );
        el.style.setProperty("--marquee-duration", `${duration}s`);
        timer = setTimeout(() => {
          el.classList.add("marquee-active");
        }, delay);
      }
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      if (timer) clearTimeout(timer);
      el.classList.remove("marquee-active");
      window.removeEventListener("resize", update);
    };
  }, [delay, text]);

  return ref;
}

export default useMarquee;
