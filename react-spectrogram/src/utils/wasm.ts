import { AudioMetadata } from '@/types'

// WASM module types
interface WASMModule {
  init_panic_hook: () => void
  parse_metadata: (bytes: Uint8Array) => any
}

let wasmModule: WASMModule | null = null
let isInitializing = false
let initPromise: Promise<WASMModule | null> | null = null

// Initialize WASM module
export async function initWASM(): Promise<WASMModule | null> {
  if (wasmModule) return wasmModule
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      isInitializing = true
      console.log('🔧 Initializing WASM module...')

      // Dynamic import of the WASM glue
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - resolved by Vite at runtime
      const module: any = await import('../wasm/web_spectrogram')

      // Initialize the wasm instance by calling the default init
      if (typeof module.default === 'function') {
        await module.default()
      }

      // Initialize panic hook
      if (typeof module.init_panic_hook === 'function') {
        module.init_panic_hook()
      }

      wasmModule = module as unknown as WASMModule
      console.log('✅ WASM module initialized successfully')

      return wasmModule
    } catch (error) {
      console.warn('⚠️ Failed to initialize WASM module:', error)
      return null
    } finally {
      isInitializing = false
    }
  })()

  return initPromise
}

// Extract metadata using WASM if available, fallback to basic extraction
export async function extractMetadata(file: File): Promise<AudioMetadata> {
  console.log('🔍 Starting metadata extraction for:', file.name)
  console.log('📊 File details:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString()
  })

  try {
    // Try to use WASM module
    const module = await initWASM()
    if (module && module.parse_metadata) {
      try {
        // Read file data
        const fileData = new Uint8Array(await file.arrayBuffer())
        
        console.log(`🔍 Extracting metadata from ${file.name} (${fileData.length} bytes)`) 
        
        // Validate file data
        if (fileData.length === 0) {
          console.warn('⚠️ File data is empty, skipping WASM extraction')
          return extractBasicMetadata(file)
        }
        
        // Extract metadata using WASM with error handling
        let metadata: any = null
        try {
          metadata = module.parse_metadata(fileData)
        } catch (extractError) {
          console.warn('⚠️ WASM parse_metadata call failed:', extractError)
          return extractBasicMetadata(file)
        }
        
        console.log('📋 Raw WASM metadata:', metadata)
        
        // Convert the WASM metadata to our AudioMetadata format
        if (metadata && typeof metadata === 'object' && metadata !== null) {
          const convertedMetadata: AudioMetadata = {
            title: metadata.title || null,
            artist: metadata.artist || null,
            album: metadata.album || null,
            year: metadata.year || null,
            genre: metadata.genre || null,
            duration: metadata.duration || null,
            bitrate: metadata.bitrate || null,
            sample_rate: metadata.sample_rate || null,
            channels: metadata.channels || null,
            bit_depth: metadata.bit_depth || null,
            album_art: metadata.album_art ? new Uint8Array(metadata.album_art) : undefined,
            album_art_mime: metadata.album_art_mime || null,
            format: metadata.format || file.type || 'unknown'
          }
          
          // Comprehensive logging of extracted metadata
          console.log('🎵 Extracted Metadata Summary:')
          console.log('   Title:', convertedMetadata.title || 'null')
          console.log('   Artist:', convertedMetadata.artist || 'null')
          console.log('   Album:', convertedMetadata.album || 'null')
          console.log('   Year:', convertedMetadata.year || 'null')
          console.log('   Genre:', convertedMetadata.genre || 'null')
          console.log('   Duration:', convertedMetadata.duration || 'null')
          console.log('   Bitrate:', convertedMetadata.bitrate || 'null')
          console.log('   Sample Rate:', convertedMetadata.sample_rate || 'null')
          console.log('   Channels:', convertedMetadata.channels || 'null')
          console.log('   Bit Depth:', convertedMetadata.bit_depth || 'null')
          console.log('   Format:', convertedMetadata.format || 'null')
          
          // Check for album art
          if (convertedMetadata.album_art && convertedMetadata.album_art.length > 0) {
            console.log('🎨 Album art found in WASM metadata!')
            console.log('   Size:', convertedMetadata.album_art.length, 'bytes')
            console.log('   MIME:', convertedMetadata.album_art_mime || 'unknown')
            
            // Validate album art data
            const header = convertedMetadata.album_art.slice(0, 8)
            const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ')
            console.log('   Header bytes:', headerHex)
            
            // Check for valid image format headers
            if (header[0] === 0xFF && header[1] === 0xD8) {
              console.log('   ✅ Valid JPEG header detected')
            } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
              console.log('   ✅ Valid PNG header detected')
            } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
              console.log('   ✅ Valid GIF header detected')
            } else {
              console.log('   ⚠️ Unknown image format, but data present')
            }
            
            console.log('🎨 Album Art Status: TRUE')
          } else {
            console.log('❌ No album art in WASM metadata')
            console.log('🎨 Album Art Status: FALSE')
          }
          
          console.log('✅ Metadata extracted using WASM:', convertedMetadata)
          return convertedMetadata
        } else {
          console.warn('⚠️ WASM returned null or invalid metadata, falling back to basic extraction')
          return extractBasicMetadata(file)
        }
      } catch (error) {
        console.warn('⚠️ WASM metadata extraction failed, falling back to basic extraction:', error)
      }
    }
  } catch (error) {
    console.warn('⚠️ WASM module not available, using basic metadata extraction:', error)
  }

  // Fallback to basic metadata extraction
  console.log('🔄 Falling back to basic metadata extraction')
  return extractBasicMetadata(file)
}

// Basic metadata extraction (current implementation)
async function extractBasicMetadata(file: File): Promise<AudioMetadata> {
  console.log('🔧 Using basic metadata extraction for:', file.name)
  
  const metadata: AudioMetadata = {
    title: file.name.replace(/\.[^/.]+$/, ''),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    format: file.type || 'unknown',
  }

  try {
    // Create audio element to get basic info
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    
    await new Promise((resolve, reject) => {
      audio.addEventListener('loadedmetadata', resolve)
      audio.addEventListener('error', reject)
      audio.src = url
    })

    metadata.duration = audio.duration
    metadata.sample_rate = 44100 // Most common sample rate
    
    // Try to get more detailed info using AudioContext
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      metadata.sample_rate = audioBuffer.sampleRate
      metadata.channels = audioBuffer.numberOfChannels
      
      // Estimate bit depth based on file format and size
      if (file.type.includes('flac') || file.type.includes('wav')) {
        metadata.bit_depth = 16
      } else if (file.type.includes('mp3')) {
        metadata.bit_depth = 16
      } else {
        metadata.bit_depth = 16
      }
      
      audioContext.close()
    } catch (decodeError) {
      console.warn('Failed to decode audio for detailed metadata:', decodeError)
    }
    
    // Estimate bitrate based on file size and duration
    if (metadata.duration) {
      const fileSizeInBits = file.size * 8
      metadata.bitrate = Math.round(fileSizeInBits / metadata.duration / 1000)
    }

    URL.revokeObjectURL(url)
  } catch (error) {
    console.warn('Failed to parse audio metadata:', error)
  }

  // Log basic metadata extraction results
  console.log('🎵 Basic Metadata Extraction Summary:')
  console.log('   Title:', metadata.title || 'null')
  console.log('   Artist:', metadata.artist || 'null')
  console.log('   Album:', metadata.album || 'null')
  console.log('   Duration:', metadata.duration || 'null')
  console.log('   Sample Rate:', metadata.sample_rate || 'null')
  console.log('   Channels:', metadata.channels || 'null')
  console.log('   Bit Depth:', metadata.bit_depth || 'null')
  console.log('   Bitrate:', metadata.bitrate || 'null')
  console.log('   Format:', metadata.format || 'null')
  console.log('🎨 Album Art Status: FALSE (basic extraction)')

  return metadata
}

// Check if WASM is available
export function isWASMAvailable(): boolean {
  return wasmModule !== null
}

// Get WASM module status
export function getWASMStatus(): { available: boolean; initializing: boolean } {
  return {
    available: wasmModule !== null,
    initializing: isInitializing
  }
}
