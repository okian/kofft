import { AudioMetadata, ArtworkSource, ArtworkResult, MusicBrainzResponse, AcoustIDResponse } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'

// Generate a deterministic placeholder artwork based on file hash or metadata
function generatePlaceholderArtwork(metadata: AudioMetadata, filename: string): ArtworkSource {
  // Create a hash from metadata or filename
  const hashInput = `${metadata.artist || ''}-${metadata.album || ''}-${metadata.title || ''}-${filename}`
  let hash = 0
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Generate colors based on hash
  const hue = Math.abs(hash) % 360
  const saturation = 60 + (Math.abs(hash >> 8) % 40)
  const lightness = 40 + (Math.abs(hash >> 16) % 30)

  // Create SVG placeholder
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue + 30},${saturation}%,${lightness - 10}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#grad)"/>
      <text x="150" y="140" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">${metadata.artist || 'Unknown'}</text>
      <text x="150" y="170" font-family="Arial, sans-serif" font-size="18" fill="white" text-anchor="middle">${metadata.album || 'Album'}</text>
      <text x="150" y="200" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle">${metadata.title || filename}</text>
    </svg>
  `

  // Convert SVG to Uint8Array
  const encoder = new TextEncoder()
  const svgData = encoder.encode(svg)

  return {
    type: 'placeholder',
    data: svgData,
    mimeType: 'image/svg+xml',
    confidence: 0.1,
    metadata: {
      artist: metadata.artist,
      album: metadata.album,
      title: metadata.title
    }
  }
}

// Parse filename to extract artist, album, title
function parseFilename(filename: string): { artist?: string; album?: string; title?: string } {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Common patterns: "Artist - Album - Title" or "Artist - Title"
  const patterns = [
    /^(.+?)\s*-\s*(.+?)\s*-\s*(.+)$/, // Artist - Album - Title
    /^(.+?)\s*-\s*(.+)$/, // Artist - Title
  ]

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern)
    if (match) {
      if (match.length === 4) {
        return {
          artist: match[1].trim(),
          album: match[2].trim(),
          title: match[3].trim()
        }
      } else if (match.length === 3) {
        return {
          artist: match[1].trim(),
          title: match[2].trim()
        }
      }
    }
  }

  return { title: nameWithoutExt }
}

// Search MusicBrainz for releases
async function searchMusicBrainz(artist: string, album: string): Promise<ArtworkSource | null> {
  try {
    const query = `artist:"${encodeURIComponent(artist)}" AND release:"${encodeURIComponent(album)}"`
    const response = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=5`,
      {
        headers: {
          'User-Agent': 'SpectrogramPWA/1.0 (https://github.com/your-repo)'
        }
      }
    )

    if (!response.ok) {
      console.warn('MusicBrainz search failed:', response.status)
      return null
    }

    const data: MusicBrainzResponse = await response.json()
    
    if (!data.releases || data.releases.length === 0) {
      return null
    }

    // Get the best match (highest score or first)
    const bestRelease = data.releases[0]
    
    // Fetch artwork from Cover Art Archive
    const artworkResponse = await fetch(
      `https://coverartarchive.org/release/${bestRelease.id}/front`,
      {
        headers: {
          'User-Agent': 'SpectrogramPWA/1.0 (https://github.com/your-repo)'
        }
      }
    )

    if (!artworkResponse.ok) {
      console.warn('Cover Art Archive fetch failed:', artworkResponse.status)
      return null
    }

    const artworkData = await artworkResponse.arrayBuffer()
    const mimeType = artworkResponse.headers.get('content-type') || 'image/jpeg'

    return {
      type: 'musicbrainz',
      url: `https://coverartarchive.org/release/${bestRelease.id}/front`,
      data: new Uint8Array(artworkData),
      mimeType,
      confidence: Math.min(bestRelease.score / 100, 0.9),
      metadata: {
        artist,
        album,
        mbid: bestRelease.id
      }
    }
  } catch (error) {
    console.warn('MusicBrainz search error:', error)
    return null
  }
}

// Search AcoustID for fingerprint matching
async function searchAcoustID(fingerprint: string, duration: number, metadata: AudioMetadata): Promise<ArtworkSource | null> {
  const settings = useSettingsStore.getState()
  const apiKey = settings.apiKeys.acoustid

  if (!apiKey || !settings.enableAcoustID) {
    return null
  }

  try {
    const response = await fetch(
      `https://api.acoustid.org/v2/lookup?client=${apiKey}&meta=recordings+releasegroups&fingerprint=${fingerprint}&duration=${duration}`
    )

    if (!response.ok) {
      console.warn('AcoustID lookup failed:', response.status)
      return null
    }

    const data: AcoustIDResponse = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return null
    }

    const bestResult = data.results[0]
    
    if (!bestResult.recordings || bestResult.recordings.length === 0) {
      return null
    }

    const recording = bestResult.recordings[0]
    
    if (!recording.releasegroups || recording.releasegroups.length === 0) {
      return null
    }

    const releaseGroup = recording.releasegroups[0]
    
    // Try to get artwork from MusicBrainz using the release group
    const mbResponse = await fetch(
      `https://musicbrainz.org/ws/2/release/?release-group=${releaseGroup.id}&fmt=json&limit=1`,
      {
        headers: {
          'User-Agent': 'SpectrogramPWA/1.0 (https://github.com/your-repo)'
        }
      }
    )

    if (!mbResponse.ok) {
      return null
    }

    const mbData: MusicBrainzResponse = await mbResponse.json()
    
    if (!mbData.releases || mbData.releases.length === 0) {
      return null
    }

    const release = mbData.releases[0]
    
    // Fetch artwork from Cover Art Archive
    const artworkResponse = await fetch(
      `https://coverartarchive.org/release/${release.id}/front`,
      {
        headers: {
          'User-Agent': 'SpectrogramPWA/1.0 (https://github.com/your-repo)'
        }
      }
    )

    if (!artworkResponse.ok) {
      return null
    }

    const artworkData = await artworkResponse.arrayBuffer()
    const mimeType = artworkResponse.headers.get('content-type') || 'image/jpeg'

    return {
      type: 'acoustid',
      url: `https://coverartarchive.org/release/${release.id}/front`,
      data: new Uint8Array(artworkData),
      mimeType,
      confidence: Math.min(bestResult.score, 0.8),
      metadata: {
        artist: recording.artists?.[0]?.name,
        album: releaseGroup.title,
        title: recording.title,
        mbid: release.id
      }
    }
  } catch (error) {
    console.warn('AcoustID lookup error:', error)
    return null
  }
}

// Generate Chromaprint fingerprint (simplified - would need actual Chromaprint WASM)
async function generateFingerprint(audioData: ArrayBuffer): Promise<string | null> {
  // This is a placeholder - in a real implementation, you'd use Chromaprint WASM
  // For now, we'll return null to skip AcoustID fingerprinting
  console.warn('Chromaprint fingerprinting not implemented - skipping AcoustID lookup')
  return null
}

// Main artwork extraction function implementing the multi-step system
export async function extractArtwork(
  metadata: AudioMetadata,
  filename: string,
  audioData?: ArrayBuffer
): Promise<ArtworkResult> {
  const settings = useSettingsStore.getState()
  const sources: ArtworkSource[] = []
  let bestArtwork: ArtworkSource | null = null

  console.log('🎨 Starting multi-step artwork extraction for:', filename)
  console.log('📋 Metadata for artwork extraction:', {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    hasEmbeddedArt: metadata.album_art ? metadata.album_art.length > 0 : false,
    embeddedArtSize: metadata.album_art?.length || 0
  })
  console.log('⚙️ Artwork settings:', {
    enableExternalArtwork: settings.enableExternalArtwork,
    enableMusicBrainz: settings.enableMusicBrainz,
    enableAcoustID: settings.enableAcoustID,
    enablePlaceholderArtwork: settings.enablePlaceholderArtwork
  })

  // Step 1: Embedded Artwork (first priority)
  if (metadata.album_art && metadata.album_art.length > 0) {
    console.log('🎨 Step 1: Found embedded artwork')
    const embeddedArtwork: ArtworkSource = {
      type: 'embedded',
      data: metadata.album_art,
      mimeType: metadata.album_art_mime || 'image/jpeg',
      confidence: 1.0,
      metadata: {
        artist: metadata.artist,
        album: metadata.album,
        title: metadata.title
      }
    }
    sources.push(embeddedArtwork)
    bestArtwork = embeddedArtwork
    console.log('✅ Found embedded artwork - size:', metadata.album_art.length, 'bytes')
  } else {
    console.log('❌ Step 1: No embedded artwork found')
  }

  // Step 2: MusicBrainz lookup (if external artwork is enabled and we have artist/album)
  if (settings.enableExternalArtwork && settings.enableMusicBrainz && metadata.artist && metadata.album) {
    console.log('🎨 Step 2: Trying MusicBrainz lookup for:', metadata.artist, '-', metadata.album)
    try {
      const mbArtwork = await searchMusicBrainz(metadata.artist, metadata.album)
      if (mbArtwork) {
        sources.push(mbArtwork)
        if (!bestArtwork || mbArtwork.confidence > bestArtwork.confidence) {
          bestArtwork = mbArtwork
        }
        console.log('✅ Found MusicBrainz artwork - confidence:', mbArtwork.confidence)
      } else {
        console.log('❌ MusicBrainz lookup returned no results')
      }
    } catch (error) {
      console.warn('❌ MusicBrainz lookup failed:', error)
    }
  } else {
    console.log('⏭️ Step 2: Skipping MusicBrainz lookup -', {
      externalEnabled: settings.enableExternalArtwork,
      musicbrainzEnabled: settings.enableMusicBrainz,
      hasArtist: !!metadata.artist,
      hasAlbum: !!metadata.album
    })
  }

  // Step 3: AcoustID fingerprinting (if enabled and we have audio data)
  if (settings.enableExternalArtwork && settings.enableAcoustID && audioData && metadata.duration) {
    console.log('🎨 Step 3: Trying AcoustID fingerprinting')
    try {
      const fingerprint = await generateFingerprint(audioData)
      if (fingerprint) {
        const acoustidArtwork = await searchAcoustID(fingerprint, metadata.duration, metadata)
        if (acoustidArtwork) {
          sources.push(acoustidArtwork)
          if (!bestArtwork || acoustidArtwork.confidence > bestArtwork.confidence) {
            bestArtwork = acoustidArtwork
          }
          console.log('✅ Found AcoustID artwork - confidence:', acoustidArtwork.confidence)
        } else {
          console.log('❌ AcoustID lookup returned no results')
        }
      } else {
        console.log('❌ Could not generate fingerprint for AcoustID')
      }
    } catch (error) {
      console.warn('❌ AcoustID lookup failed:', error)
    }
  } else {
    console.log('⏭️ Step 3: Skipping AcoustID fingerprinting -', {
      externalEnabled: settings.enableExternalArtwork,
      acoustidEnabled: settings.enableAcoustID,
      hasAudioData: !!audioData,
      hasDuration: !!metadata.duration
    })
  }

  // Step 4: Filename heuristic → MusicBrainz
  if (settings.enableExternalArtwork && settings.enableMusicBrainz && !bestArtwork) {
    console.log('🎨 Step 4: Trying filename-based MusicBrainz lookup')
    try {
      const parsed = parseFilename(filename)
      console.log('📝 Parsed filename:', parsed)
      if (parsed.artist && parsed.album) {
        const filenameArtwork = await searchMusicBrainz(parsed.artist, parsed.album)
        if (filenameArtwork) {
          sources.push(filenameArtwork)
          if (!bestArtwork || filenameArtwork.confidence > bestArtwork.confidence) {
            bestArtwork = filenameArtwork
          }
          console.log('✅ Found artwork via filename parsing - confidence:', filenameArtwork.confidence)
        } else {
          console.log('❌ Filename-based MusicBrainz lookup returned no results')
        }
      } else {
        console.log('❌ Could not parse artist/album from filename')
      }
    } catch (error) {
      console.warn('❌ Filename-based lookup failed:', error)
    }
  } else {
    console.log('⏭️ Step 4: Skipping filename-based lookup -', {
      externalEnabled: settings.enableExternalArtwork,
      musicbrainzEnabled: settings.enableMusicBrainz,
      hasBestArtwork: !!bestArtwork
    })
  }

  // Step 5: Placeholder (last resort)
  if (settings.enablePlaceholderArtwork && !bestArtwork) {
    console.log('🎨 Step 5: Generating placeholder artwork')
    const placeholder = generatePlaceholderArtwork(metadata, filename)
    sources.push(placeholder)
    bestArtwork = placeholder
    console.log('✅ Generated placeholder artwork')
  } else {
    console.log('⏭️ Step 5: Skipping placeholder generation -', {
      placeholderEnabled: settings.enablePlaceholderArtwork,
      hasBestArtwork: !!bestArtwork
    })
  }

  const result: ArtworkResult = {
    success: bestArtwork !== null,
    artwork: bestArtwork || undefined,
    sources,
    error: bestArtwork ? undefined : 'No artwork found'
  }

  console.log(`🎨 Artwork extraction complete: ${result.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`   Sources found: ${sources.length}`)
  console.log(`   Best confidence: ${bestArtwork?.confidence || 0}`)
  console.log(`   Best artwork type: ${bestArtwork?.type || 'none'}`)
  console.log(`   Best artwork size: ${bestArtwork?.data?.length || 0} bytes`)

  return result
}

// Utility function to get artwork from a track
export async function getTrackArtwork(track: any): Promise<ArtworkSource | null> {
  if (track.artwork) {
    return track.artwork
  }

  // Extract artwork if not already done
  const result = await extractArtwork(track.metadata, track.file.name)
  if (result.success && result.artwork) {
    // Store the artwork in the track for future use
    track.artwork = result.artwork
    return result.artwork
  }

  return null
}
