import { useEffect } from "react";
import { useSettingsStore } from "@/shared/stores/settingsStore";
import { THEME_COLORS } from "@/shared/theme";

/**
 * React hook that synchronises CSS variables controlling the seekbar colours
 * with the current theme and any user overrides stored in settings.
 * Running this hook ensures that components reading --seek-played and
 * --seek-unplayed always receive up-to-date values without hard-coded fallbacks.
 */
export function useSeekbarColors(): void {
  const { theme, seekPlayedColor, seekUnplayedColor } = useSettingsStore(
    (state) => ({
      theme: state.theme,
      seekPlayedColor: state.seekPlayedColor,
      seekUnplayedColor: state.seekUnplayedColor,
    }),
  );

  useEffect(() => {
    const root = document.documentElement;
    const { accent, primary } = THEME_COLORS[theme];
    // Apply overrides if present; otherwise fall back to theme colours.
    root.style.setProperty("--seek-played", (seekPlayedColor || accent).trim());
    root.style.setProperty(
      "--seek-unplayed",
      (seekUnplayedColor || primary).trim(),
    );
  }, [theme, seekPlayedColor, seekUnplayedColor]);
}
