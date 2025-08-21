import React, { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from 'react'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { Theme } from '@/shared/types'

/**
 * Default maximum canvas dimension in pixels used when the device does not
 * expose its WebGL limits. This conservative value prevents allocating
 * excessively large buffers on constrained devices.
 */
export const FALLBACK_MAX_CANVAS_SIZE = 4096

/**
 * Duration in seconds that the spectrogram keeps in its scrolling history.
 * This replaces previously inlined magic numbers to clarify intent.
 */
const TIME_WINDOW_SECONDS = 15

interface SpectrogramCanvasProps {
  onMouseMove?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseLeave?: () => void
  onMouseClick?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onTouchStart?: (event: React.TouchEvent<HTMLCanvasElement>) => void
  onTouchEnd?: () => void
  className?: string
}

export interface SpectrogramCanvasRef {
  addFrame: (frequencyData: Uint8Array) => void
  clear: () => void
  resize: () => void
  getCanvas: () => HTMLCanvasElement | null
}

export const SpectrogramCanvas = forwardRef<SpectrogramCanvasRef, SpectrogramCanvasProps>(
  ({ onMouseMove, onMouseLeave, onMouseClick, onTouchStart, onTouchEnd, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const textureRef = useRef<WebGLTexture | null>(null)
    const bufferRef = useRef<WebGLBuffer | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const webglSupportedRef = useRef(false)
    // Tracks the maximum supported canvas dimension. Defaults to a safe value
    // until a WebGL context reveals the precise device limit.
    const maxTextureSizeRef = useRef<number>(FALLBACK_MAX_CANVAS_SIZE)
    
    const { theme, amplitudeScale, refreshRate } = useSettingsStore()

    // Spectrogram data storage
    const spectrogramDataRef = useRef<Uint8Array[]>([])
    // Maximum number of frames maintained to cover TIME_WINDOW_SECONDS.
    const maxFramesRef = useRef(TIME_WINDOW_SECONDS * refreshRate)
    const currentFrameRef = useRef(0)

    // Color maps for different themes
    const colorMaps: Record<Theme, {
      background: [number, number, number, number];
      low: [number, number, number, number];
      mid: [number, number, number, number];
      high: [number, number, number, number];
      peak: [number, number, number, number];
    }> = {
      'japanese-a-light': {
        background: [1, 1, 1, 1],     // White background
        low: [0, 0, 0, 0.1],          // Very light black
        mid: [0, 0, 0, 0.5],          // Medium black
        high: [0, 0, 0, 0.8],         // Dark black
        peak: [0, 0, 0, 1]            // Pure black
      },
      'japanese-a-dark': {
        background: [0, 0, 0, 1],     // Black background
        low: [1, 1, 1, 0.1],          // Very light white
        mid: [1, 1, 1, 0.5],          // Medium white
        high: [1, 1, 1, 0.8],         // Bright white
        peak: [1, 1, 1, 1]            // Pure white
      },
      'japanese-b-light': {
        background: [1, 1, 1, 1],     // White background
        low: [0.9, 0, 0.15, 0.2],     // Light red
        mid: [0.9, 0, 0.15, 0.6],     // Medium red
        high: [0.9, 0, 0.15, 0.9],    // Dark red
        peak: [0.9, 0, 0.15, 1]       // Pure red (Japanese flag red)
      },
      'japanese-b-dark': {
        background: [0, 0, 0, 1],     // Black background
        low: [0.9, 0, 0.15, 0.2],     // Light red
        mid: [0.9, 0, 0.15, 0.6],     // Medium red
        high: [0.9, 0, 0.15, 0.9],    // Dark red
        peak: [0.9, 0, 0.15, 1]       // Pure red (Japanese flag red)
      },
      'bauhaus-light': {
        background: [1, 1, 1, 1],     // White background
        low: [0, 0, 1, 0.3],          // Light blue
        mid: [0, 0, 1, 0.7],          // Medium blue
        high: [1, 0, 0, 0.8],         // Red
        peak: [1, 0, 0, 1]            // Pure red
      },
      'bauhaus-dark': {
        background: [0, 0, 0, 1],     // Black background
        low: [1, 1, 0, 0.3],          // Light yellow
        mid: [1, 1, 0, 0.7],          // Medium yellow
        high: [1, 0, 0, 0.8],         // Red
        peak: [1, 0, 0, 1]            // Pure red
      }
    }

    // Check WebGL support
    const checkWebGLSupport = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return false

      try {
        const gl = canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false
        })

        if (!gl) {
          return false
        }

        // Test basic WebGL functionality
        const testShader = gl.createShader(gl.VERTEX_SHADER)
        if (!testShader) {
          return false
        }

        gl.deleteShader(testShader)
        return true
      } catch (error) {
        return false
      }
    }, [])

    // Initialize WebGL
    const initWebGL = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return false

      // Check WebGL support first
      if (!checkWebGLSupport()) {
        webglSupportedRef.current = false
        return false
      }

      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false
      })

      if (!gl) {
        webglSupportedRef.current = false
        return false
      }

      glRef.current = gl
      webglSupportedRef.current = true
      // Record the device's maximum supported texture size to avoid exceeding
      // hardware limits during future resizes.
      maxTextureSizeRef.current = gl.getParameter(gl.MAX_TEXTURE_SIZE) || FALLBACK_MAX_CANVAS_SIZE

      // Create shaders
      const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texCoord = a_texCoord;
        }
      `

      const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D u_texture;
        uniform vec4 u_lowColor;
        uniform vec4 u_midColor;
        uniform vec4 u_highColor;
        uniform vec4 u_peakColor;
        uniform float u_intensityScale;
        varying vec2 v_texCoord;
        
        void main() {
          vec4 texColor = texture2D(u_texture, v_texCoord);
          float intensity = texColor.r;
          
          // Apply intensity scale
          if (u_intensityScale > 0.5) {
            // Logarithmic scale
            intensity = log(max(intensity, 0.001)) / log(0.001);
          }
          
          // Color mapping
          vec4 color;
          if (intensity < 0.25) {
            color = mix(u_lowColor, u_midColor, intensity * 4.0);
          } else if (intensity < 0.5) {
            color = mix(u_midColor, u_highColor, (intensity - 0.25) * 4.0);
          } else if (intensity < 0.75) {
            color = mix(u_highColor, u_peakColor, (intensity - 0.5) * 4.0);
          } else {
            color = u_peakColor;
          }
          
          gl_FragColor = color;
        }
      `

      const vertexShader = gl.createShader(gl.VERTEX_SHADER)
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)

      if (!vertexShader || !fragmentShader) {
        webglSupportedRef.current = false
        return false
      }

      gl.shaderSource(vertexShader, vertexShaderSource)
      gl.shaderSource(fragmentShader, fragmentShaderSource)
      gl.compileShader(vertexShader)
      gl.compileShader(fragmentShader)

      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        webglSupportedRef.current = false
        return false
      }

      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        webglSupportedRef.current = false
        return false
      }

      // Create program
      const program = gl.createProgram()
      if (!program) {
        webglSupportedRef.current = false
        return false
      }

      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        webglSupportedRef.current = false
        return false
      }

      programRef.current = program

      // Create vertex buffer
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

      // Full-screen quad vertices
      const vertices = new Float32Array([
        // Position (x, y), TexCoord (u, v)
        -1, -1,  0, 1,  // Bottom left
         1, -1,  1, 1,  // Bottom right
        -1,  1,  0, 0,  // Top left
         1,  1,  1, 0   // Top right
      ])

      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
      bufferRef.current = buffer

      // Create texture
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      textureRef.current = texture

      // Set up attributes and uniforms
      const positionLocation = gl.getAttribLocation(program, 'a_position')
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')

      gl.enableVertexAttribArray(positionLocation)
      gl.enableVertexAttribArray(texCoordLocation)

      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0)
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8)

      return true
    }, [checkWebGLSupport])

    // Resize canvas
    /**
     * Resizes the backing canvas buffer to match its on-screen dimensions while
     * respecting hardware-imposed limits. The function fails fast on invalid
     * metrics and clamps oversized requests to the maximum supported texture
     * size to avoid costly allocations or WebGL errors.
     */
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1

      let targetWidth = rect.width * pixelRatio
      let targetHeight = rect.height * pixelRatio

      if (!isFinite(targetWidth) || !isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
        console.warn('SpectrogramCanvas: invalid canvas size computed during resize')
        return
      }

      const maxSize = maxTextureSizeRef.current
      if (targetWidth > maxSize || targetHeight > maxSize) {
        console.warn(`SpectrogramCanvas: clamping canvas to device limit ${maxSize}`)
        targetWidth = Math.min(targetWidth, maxSize)
        targetHeight = Math.min(targetHeight, maxSize)
      }

      canvas.width = targetWidth
      canvas.height = targetHeight
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'

      if (webglSupportedRef.current && glRef.current) {
        glRef.current.viewport(0, 0, canvas.width, canvas.height)
      }
    }, [])

    // Update spectrogram texture
    const updateTexture = useCallback(() => {
      if (!webglSupportedRef.current) return

      const gl = glRef.current
      const texture = textureRef.current
      if (!gl || !texture) return

      const data = spectrogramDataRef.current
      if (data.length === 0) return

      // Create a 2D array from the spectrogram data
      const width = data[0].length
      const height = data.length
      const imageData = new Uint8Array(width * height)

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x
          imageData[index] = data[y][x]
        }
      }

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, imageData)
    }, [])

    // Render spectrogram
    const render = useCallback(() => {
      if (!webglSupportedRef.current) return

      const gl = glRef.current
      const program = programRef.current
      if (!gl || !program) return

      const colors = colorMaps[theme as keyof typeof colorMaps] || colorMaps["japanese-a-dark"]

      gl.useProgram(program)

      // Set uniforms
      const lowColorLocation = gl.getUniformLocation(program, 'u_lowColor')
      const midColorLocation = gl.getUniformLocation(program, 'u_midColor')
      const highColorLocation = gl.getUniformLocation(program, 'u_highColor')
      const peakColorLocation = gl.getUniformLocation(program, 'u_peakColor')
      const intensityScaleLocation = gl.getUniformLocation(program, 'u_intensityScale')

      gl.uniform4fv(lowColorLocation, colors.low)
      gl.uniform4fv(midColorLocation, colors.mid)
      gl.uniform4fv(highColorLocation, colors.high)
      gl.uniform4fv(peakColorLocation, colors.peak)
      gl.uniform1f(intensityScaleLocation, amplitudeScale === 'db' ? 1.0 : 0.0)

      // Clear with background color
      gl.clearColor(colors.background[0], colors.background[1], colors.background[2], colors.background[3])
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Draw full-screen quad
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [theme, amplitudeScale])

    // Animation loop
    const animate = useCallback(() => {
      if (webglSupportedRef.current) {
        updateTexture()
        render()
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }, [updateTexture, render])

    // Add new frame to spectrogram
    const addFrame = useCallback((frequencyData: Uint8Array) => {
      const data = [...spectrogramDataRef.current]
      
      // Add new frame at the beginning (top of waterfall)
      data.unshift(frequencyData)
      
      // Remove old frames if we exceed the time window
      if (data.length > maxFramesRef.current) {
        data.splice(maxFramesRef.current)
      }
      
      spectrogramDataRef.current = data
      currentFrameRef.current = data.length
    }, [])

    // Clear spectrogram
    const clear = useCallback(() => {
      spectrogramDataRef.current = []
      currentFrameRef.current = 0
    }, [])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      addFrame,
      clear,
      resize: resizeCanvas,
      getCanvas: () => canvasRef.current
    }), [addFrame, clear, resizeCanvas])

    // Initialize WebGL on mount
    useEffect(() => {
      if (initWebGL()) {
        resizeCanvas()
        animate()
      } else {
        // Fallback: just start animation loop for non-WebGL environments
        animate()
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }, [initWebGL, resizeCanvas, animate])

    /**
     * Reacts to WebGL context loss events by halting rendering and attempts to
     * reinitialise the pipeline once the context is restored. This guards
     * against driver resets and resource exhaustion on unstable devices.
     */
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const handleContextLost = (event: Event) => {
        event.preventDefault()
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        webglSupportedRef.current = false
      }

      const handleContextRestored = () => {
        if (initWebGL()) {
          resizeCanvas()
        }
          animate()
        } else {
          // Fallback: just start animation loop for non-WebGL environments
          animate()
        }
      }

      canvas.addEventListener('webglcontextlost', handleContextLost as EventListener)
      canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener)

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored as EventListener)
      }
    }, [initWebGL, resizeCanvas, animate])

    // Handle window resize
    useEffect(() => {
      const handleResize = () => {
        resizeCanvas()
      }

      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [resizeCanvas])

    // Update max frames when refresh rate changes
    useEffect(() => {
      maxFramesRef.current = TIME_WINDOW_SECONDS * refreshRate
      
      // Trim data if needed
      if (spectrogramDataRef.current.length > maxFramesRef.current) {
        spectrogramDataRef.current = spectrogramDataRef.current.slice(0, maxFramesRef.current)
      }
    }, [refreshRate])

    return (
      <canvas
        ref={canvasRef}
        className={className || "w-full h-full block"}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onMouseClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ cursor: 'crosshair' }}
        data-testid="spectrogram-canvas"
      />
    )
  }
)

SpectrogramCanvas.displayName = 'SpectrogramCanvas'
