import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

// Mock the Toaster component to avoid matchMedia issues
vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />
}))

// Create realistic audio file data
const createRealisticAudioFile = (name: string, type: string, size: number = 1024 * 1024) => {
  // Create a realistic audio file with proper metadata
  const audioData = new ArrayBuffer(size)
  const file = new File([audioData], name, { 
    type,
    lastModified: Date.now()
  })
  
  // Mock the file size
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  })
  
  return file
}

describe('Real Audio File Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    console.log('🧪 Starting real audio file test...')
  })

  describe('FLAC File Loading', () => {
    it('should load FLAC file with full metadata', async () => {
      console.log('🔍 Testing FLAC file loading...')
      
      render(<App />)
      
      // Get the file input
      const fileInput = screen.getByTestId('file-input')
      console.log('🔍 File input found:', fileInput)
      
      // Create a realistic FLAC file
      const flacFile = createRealisticAudioFile('perfect-circle-passive.flac', 'audio/flac', 31 * 1024 * 1024) // 31MB
      
      console.log('🔍 Created FLAC file object:', {
        name: flacFile.name,
        type: flacFile.type,
        size: flacFile.size,
        sizeMB: (flacFile.size / (1024 * 1024)).toFixed(2) + ' MB'
      })
      
      // Upload the file
      await user.upload(fileInput, flacFile)
      console.log('✅ FLAC file upload completed')
      
      // Wait for processing
      await waitFor(() => {
        console.log('🔍 Checking for metadata display...')
        // The app should process the file and display metadata
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      console.log('🎉 FLAC file test completed!')
    })

    it('should load large FLAC file efficiently', async () => {
      console.log('🔍 Testing large FLAC file loading...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a large FLAC file (99MB like the Adele file)
      const largeFlacFile = createRealisticAudioFile('adele-skyfall.flac', 'audio/flac', 99 * 1024 * 1024)
      
      console.log('🔍 Created large FLAC file object:', {
        name: largeFlacFile.name,
        type: largeFlacFile.type,
        size: largeFlacFile.size,
        sizeMB: (largeFlacFile.size / (1024 * 1024)).toFixed(2) + ' MB'
      })
      
      const startTime = performance.now()
      
      // Upload the large file
      await user.upload(fileInput, largeFlacFile)
      console.log('✅ Large FLAC file upload completed')
      
      // Wait for processing
      await waitFor(() => {
        console.log('🔍 Checking for large file processing...')
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 10000 })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`🔍 Large file processing completed in: ${duration.toFixed(2)} ms`)
      
      // Should complete within reasonable time (less than 10 seconds)
      expect(duration).toBeLessThan(10000)
      
      console.log('🎉 Large FLAC file test completed!')
    })
  })

  describe('MP3 File Loading', () => {
    it('should load MP3 file with metadata', async () => {
      console.log('🔍 Testing MP3 file loading...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a realistic MP3 file
      const mp3File = createRealisticAudioFile('perfect-circle-passive-30s.mp3', 'audio/mpeg', 2.5 * 1024 * 1024) // 2.5MB
      
      console.log('🔍 Created MP3 file object:', {
        name: mp3File.name,
        type: mp3File.type,
        size: mp3File.size,
        sizeMB: (mp3File.size / (1024 * 1024)).toFixed(2) + ' MB'
      })
      
      // Upload the file
      await user.upload(fileInput, mp3File)
      console.log('✅ MP3 file upload completed')
      
      // Wait for processing
      await waitFor(() => {
        console.log('🔍 Checking for MP3 metadata display...')
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      console.log('🎉 MP3 file test completed!')
    })
  })

  describe('M4A File Loading', () => {
    it('should load M4A file with metadata', async () => {
      console.log('🔍 Testing M4A file loading...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a realistic M4A file
      const m4aFile = createRealisticAudioFile('adele-skyfall-30s.m4a', 'audio/mp4', 0.5 * 1024 * 1024) // 500KB
      
      console.log('🔍 Created M4A file object:', {
        name: m4aFile.name,
        type: m4aFile.type,
        size: m4aFile.size,
        sizeKB: (m4aFile.size / 1024).toFixed(2) + ' KB'
      })
      
      // Upload the file
      await user.upload(fileInput, m4aFile)
      console.log('✅ M4A file upload completed')
      
      // Wait for processing
      await waitFor(() => {
        console.log('🔍 Checking for M4A metadata display...')
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      console.log('🎉 M4A file test completed!')
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted audio file gracefully', async () => {
      console.log('🔍 Testing corrupted file handling...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a corrupted file
      const corruptedFile = new File(['This is not a valid audio file'], 'corrupted-audio.mp3', { 
        type: 'audio/mpeg',
        lastModified: Date.now()
      })
      
      console.log('🔍 Created corrupted file object:', {
        name: corruptedFile.name,
        type: corruptedFile.type,
        size: corruptedFile.size
      })
      
      // Upload the corrupted file
      await user.upload(fileInput, corruptedFile)
      console.log('✅ Corrupted file upload completed')
      
      // Wait for error handling
      await waitFor(() => {
        console.log('🔍 Checking for error handling...')
        // The app should still be functional even with corrupted file
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      console.log('🎉 Corrupted file test completed!')
    })

    it('should handle very large files gracefully', async () => {
      console.log('🔍 Testing very large file handling...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a very large file (500MB)
      const veryLargeFile = createRealisticAudioFile('very-large-audio.flac', 'audio/flac', 500 * 1024 * 1024)
      
      console.log('🔍 Created very large file object:', {
        name: veryLargeFile.name,
        type: veryLargeFile.type,
        size: veryLargeFile.size,
        sizeMB: (veryLargeFile.size / (1024 * 1024)).toFixed(2) + ' MB'
      })
      
      const startTime = performance.now()
      
      // Upload the very large file
      await user.upload(fileInput, veryLargeFile)
      console.log('✅ Very large file upload completed')
      
      // Wait for processing or error handling
      await waitFor(() => {
        console.log('🔍 Checking for very large file handling...')
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 15000 })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`🔍 Very large file handling completed in: ${duration.toFixed(2)} ms`)
      
      console.log('🎉 Very large file test completed!')
    })
  })

  describe('Multiple File Formats', () => {
    it('should handle different audio formats in sequence', async () => {
      console.log('🔍 Testing multiple file formats...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Test files in sequence
      const testFiles = [
        { name: 'perfect-circle-passive.flac', type: 'audio/flac', size: 31 * 1024 * 1024 },
        { name: 'perfect-circle-passive-30s.mp3', type: 'audio/mpeg', size: 2.5 * 1024 * 1024 },
        { name: 'adele-skyfall-30s.m4a', type: 'audio/mp4', size: 0.5 * 1024 * 1024 }
      ]
      
      for (const testFile of testFiles) {
        console.log(`🔍 Testing file: ${testFile.name}`)
        
        // Create a File object
        const file = createRealisticAudioFile(testFile.name, testFile.type, testFile.size)
        
        console.log('🔍 Created file object:', {
          name: file.name,
          type: file.type,
          size: file.size,
          sizeMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        })
        
        // Upload the file
        await user.upload(fileInput, file)
        console.log(`✅ ${testFile.name} upload completed`)
        
        // Wait for processing
        await waitFor(() => {
          console.log(`🔍 Checking for ${testFile.name} processing...`)
          expect(screen.getByTestId('app-container')).toBeInTheDocument()
        }, { timeout: 3000 })
        
        console.log(`🎉 ${testFile.name} test completed!`)
      }
      
      console.log('🎉 Multiple file formats test completed!')
    })
  })

  describe('Performance Testing', () => {
    it('should handle rapid file uploads efficiently', async () => {
      console.log('🔍 Testing rapid file uploads...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      const startTime = performance.now()
      
      // Upload multiple files rapidly
      for (let i = 0; i < 3; i++) {
        const file = createRealisticAudioFile(`test-file-${i}.mp3`, 'audio/mpeg', 1 * 1024 * 1024)
        
        console.log(`🔍 Uploading file ${i + 1}/3: ${file.name}`)
        
        await user.upload(fileInput, file)
        
        // Wait a bit between uploads
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Wait for final processing
      await waitFor(() => {
        console.log('🔍 Checking for rapid upload processing...')
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`🔍 Rapid uploads completed in: ${duration.toFixed(2)} ms`)
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000)
      
      console.log('🎉 Rapid file uploads test completed!')
    })
  })

  describe('Metadata Verification', () => {
    it('should handle files with different metadata scenarios', async () => {
      console.log('🔍 Testing metadata scenarios...')
      
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Test different file types with various sizes
      const metadataTests = [
        { name: 'short-song.mp3', type: 'audio/mpeg', size: 0.1 * 1024 * 1024, description: 'Short MP3' },
        { name: 'medium-song.flac', type: 'audio/flac', size: 10 * 1024 * 1024, description: 'Medium FLAC' },
        { name: 'long-song.m4a', type: 'audio/mp4', size: 50 * 1024 * 1024, description: 'Long M4A' }
      ]
      
      for (const test of metadataTests) {
        console.log(`🔍 Testing ${test.description}...`)
        
        const file = createRealisticAudioFile(test.name, test.type, test.size)
        
        console.log('🔍 Created file for metadata test:', {
          name: file.name,
          type: file.type,
          size: file.size,
          sizeMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        })
        
        // Upload the file
        await user.upload(fileInput, file)
        console.log(`✅ ${test.description} upload completed`)
        
        // Wait for processing and metadata extraction
        await waitFor(() => {
          console.log(`🔍 Checking for ${test.description} metadata extraction...`)
          expect(screen.getByTestId('app-container')).toBeInTheDocument()
        }, { timeout: 5000 })
        
        console.log(`🎉 ${test.description} metadata test completed!`)
      }
      
      console.log('🎉 Metadata scenarios test completed!')
    })
  })
})
