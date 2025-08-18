# Technical Notes

## Issues Found
- **Pause/Resume Reset**: `AudioPlayerEngine.resumePlayback` restarted tracks from the beginning instead of the paused position, violating the expectation that seeking and pausing preserve playback position.

## Key Fixes
- Added offset support to `playTrack` and updated `resumePlayback` to start from the stored `pausedTime`. This ensures playback resumes exactly where it was paused and aligns audio with the seek bar.
- Extended unit tests for `audioPlayer` to cover resume behavior, ensuring regression coverage.

## Performance
- Changes keep hot path in TypeScript, as the fix involves state handling only and introduces no additional allocations.

## Follow‑ups
- Additional integration tests around rapid pause/resume cycles and track switching could further harden timing behavior.
