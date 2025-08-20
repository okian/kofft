import { AudioMetadata } from '@/types'
import { audioPlayer } from './audioPlayer'

// Constants used during fallback probing
const FALLBACK_SAMPLE_RATE_HZ = 44100
const FALLBACK_BIT_DEPTH = 16
const BITS_PER_KILOBIT = 1000

/**
 * Extract rich metadata from an audio {@link File}.
 *
 * The function first attempts to parse tags using `music-metadata-browser`,
 * which understands the majority of ID3/metadata formats. If parsing fails
 * we fall back to a light‑weight HTML5 audio probe to at least determine
 * duration and sample information. The function never throws and always
 * resolves with a fully populated {@link AudioMetadata} object.
 */
export async function extractMetadata (file: File): Promise<AudioMetadata> {
  if (!(file instanceof File)) {
    throw new TypeError('extractMetadata expects a File object')
  }

  // Base object populated with conservative defaults so callers can rely on
  // every field existing even when extraction fails partially.
  const metadata: AudioMetadata = {
    title: file.name.replace(/\.[^/.]+$/, ''),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    year: undefined,
    genre: '',
    duration: 0,
    bitrate: 0,
    sample_rate: 0,
    channels: 0,
    bit_depth: 0,
    album_art: undefined,
    album_art_mime: undefined
  }

  // ---- Primary extraction -------------------------------------------------
  try {
    const { parseBlob } = await import('music-metadata-browser')
    const parsed = await parseBlob(file, { duration: true })
    const { common, format } = parsed

    if (common.title) metadata.title = common.title
    if (common.artist) metadata.artist = common.artist
    else if (Array.isArray(common.artists) && common.artists.length > 0) {
      metadata.artist = common.artists[0]
    }
    if (common.album) metadata.album = common.album
    if (typeof common.year === 'number') metadata.year = common.year
    if (Array.isArray(common.genre) && common.genre.length > 0) {
      metadata.genre = common.genre[0]
    }

    if (typeof format.duration === 'number') metadata.duration = format.duration
    if (typeof format.sampleRate === 'number') metadata.sample_rate = format.sampleRate
    if (typeof format.numberOfChannels === 'number') metadata.channels = format.numberOfChannels
    if (typeof format.bitsPerSample === 'number') metadata.bit_depth = format.bitsPerSample
    if (typeof format.bitrate === 'number') {
      metadata.bitrate = Math.round(format.bitrate / BITS_PER_KILOBIT)
    }

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0]
      if (picture.data?.length) {
        // music-metadata-browser returns a Node.js Buffer; convert without copy
        metadata.album_art = new Uint8Array(picture.data)
        metadata.album_art_mime = picture.format || undefined
      }
    }

    return metadata
  } catch (err) {
    // Parsing is best-effort; log and continue with fallback.
    console.warn('metadata parsing failed; falling back to HTML5 probe', err)
  }

  // ---- Fallback extraction ------------------------------------------------
  try {
    const url = URL.createObjectURL(file)
    const audio = new Audio()

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('error', onError)
      }
      const onLoaded = () => { cleanup(); resolve() }
      const onError = (e: Event) => { cleanup(); reject(e) }
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('error', onError)
      audio.src = url
    })

    if (Number.isFinite(audio.duration)) {
      metadata.duration = audio.duration
    }
    metadata.sample_rate = FALLBACK_SAMPLE_RATE_HZ

    try {
      const ctx = await audioPlayer.initAudioContext()
      const buffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(buffer)
      metadata.sample_rate = audioBuffer.sampleRate
      metadata.channels = audioBuffer.numberOfChannels
      metadata.bit_depth = FALLBACK_BIT_DEPTH
    } catch {
      metadata.bit_depth = FALLBACK_BIT_DEPTH
    }

    if (metadata.duration) {
      const bits = file.size * 8
      metadata.bitrate = Math.round(bits / metadata.duration / BITS_PER_KILOBIT)
    }

    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Fallback metadata extraction failed', err)
  }

  return metadata
}
