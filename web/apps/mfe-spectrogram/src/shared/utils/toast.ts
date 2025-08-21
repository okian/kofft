import toast from "react-hot-toast";
import { useSettingsStore } from "@/shared/stores/settingsStore";
import { THEME_COLORS } from "@/shared/theme";

// Conditional toast function that respects the user's settings.
// Colours are pulled from THEME_COLORS so toasts match the active light/dark
// palette without embedding hex codes.
export const conditionalToast = {
  success: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState();
    if (enableToastNotifications) {
      toast.success(message);
    }
  },

  error: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState();
    if (enableToastNotifications) {
      toast.error(message);
    }
  },

  warning: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState();
    if (enableToastNotifications) {
      toast(message, {
        icon: "⚠️",
        style: (() => {
          const { theme } = useSettingsStore.getState();
          const { accent, background } = THEME_COLORS[theme];
          return {
            borderRadius: "10px",
            background,
            color: accent,
          };
        })(),
      });
    }
  },

  info: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState();
    if (enableToastNotifications) {
      toast(message, {
        icon: "ℹ️",
        style: (() => {
          const { theme } = useSettingsStore.getState();
          const { accent, background } = THEME_COLORS[theme];
          return {
            borderRadius: "10px",
            background,
            color: accent,
          };
        })(),
      });
    }
  },
};

// Direct toast functions (always show, regardless of settings)
export const directToast = {
  success: toast.success,
  error: toast.error,
  warning: (message: string) =>
    toast(message, {
      icon: "⚠️",
      style: (() => {
        const { theme } = useSettingsStore.getState();
        const { accent, background } = THEME_COLORS[theme];
        return { borderRadius: "10px", background, color: accent };
      })(),
    }),
  info: (message: string) =>
    toast(message, {
      icon: "ℹ️",
      style: (() => {
        const { theme } = useSettingsStore.getState();
        const { accent, background } = THEME_COLORS[theme];
        return { borderRadius: "10px", background, color: accent };
      })(),
    }),
};
