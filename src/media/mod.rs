//! Media processing utilities including song identification.

#[cfg(feature = "std")]
pub mod index;

#[cfg(all(feature = "std", feature = "waveform-cache"))]
pub mod playback;
