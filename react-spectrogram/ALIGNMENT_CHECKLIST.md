# Alignment Checklist

This checklist maps high-level requirements from `design.md` and `expectation.md` to the current implementation status of the React Spectrogram app.

| Requirement | Status | Notes |
| --- | --- | --- |
| Responsive layout with header, spectrogram, sidebars, and footer | ✅ | Implemented with Flexbox panels and mobile breakpoints.
| Seek bar with amplitude bars and precise hover/drag | ⚠️ | Basic waveform seekbar exists but lacks full amplitude spec and some interactions.
| Single AudioContext reused across tracks | ✅ | `audioPlayer` maintains one shared context.
| Prevent overlapping audio when switching tracks rapidly | ✅ | Pending decode operations are cancelled using a request token.
| Event listeners cleaned up on unmount | ✅ | Hooks like `useKeyboardShortcuts` and `useScreenSize` remove listeners in cleanup.
| Playlist navigation (next/prev, repeat/shuffle) robust at boundaries | ⚠️ | Basic next/prev available; repeat/shuffle not implemented.
| Spectrogram resizes/redraws on container resize | ⚠️ | Canvas resizes but redraw lag exists on extreme resize.
| Keyboard shortcuts documented and overridable | ✅ | Shortcuts implemented with `useKeyboardShortcuts` and toast hint.
| Accessibility with ARIA labels and focus order | ⚠️ | Many controls labeled, but comprehensive audit pending.

✅ = fully implemented, ⚠️ = partial / needs work, ❌ = missing.
