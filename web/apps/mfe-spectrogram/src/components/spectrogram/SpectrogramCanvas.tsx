import React, { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from 'react'
import { useSettingsStore } from '@/shared/stores/settingsStore'

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
    
    const { theme, amplitudeScale, refreshRate } = useSettingsStore()

    // Spectrogram data storage
    const spectrogramDataRef = useRef<Uint8Array[]>([])
    const maxFramesRef = useRef(15 * refreshRate) // 15 second time window
    const currentFrameRef = useRef(0)

    // Color maps for different themes
    const colorMaps = {
      dark: {
        background: [0, 0, 0, 1],
        low: [0, 0, 0.2, 1],      // Dark blue
        mid: [1, 0.2, 0, 1],      // Red-orange
        high: [1, 0.4, 0, 1],     // Orange
        peak: [1, 0.67, 0, 1]     // Light orange
      },
      light: {
        background: [0.98, 0.98, 0.98, 1],
        low: [0, 0, 0.5, 1],      // Dark blue
        mid: [0, 0.5, 1, 1],      // Blue
        high: [1, 0.5, 0, 1],     // Orange
        peak: [1, 0, 0, 1]        // Red
      },
      neon: {
        background: [0, 0, 0, 1],
        low: [0, 0, 0, 0],        // Transparent
        mid: [0, 1, 1, 1],        // Cyan
        high: [1, 0, 1, 1],       // Magenta
        peak: [1, 1, 0, 1]        // Yellow
      },
      'high-contrast': {
        background: [0, 0, 0, 1],
        low: [0, 0, 0, 1],        // Black
        mid: [1, 1, 1, 1],        // White
        high: [1, 1, 1, 1],       // White
        peak: [1, 1, 1, 1]        // White
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
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1

      canvas.width = rect.width * pixelRatio
      canvas.height = rect.height * pixelRatio
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

      const colors = colorMaps[theme as keyof typeof colorMaps] || colorMaps.dark

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
      maxFramesRef.current = 15 * refreshRate // 15 second time window
      
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
