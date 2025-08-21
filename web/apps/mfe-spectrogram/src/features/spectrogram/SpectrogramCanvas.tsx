import React, { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from 'react'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { Theme } from '@/shared/types'
import { useSpectrogramStore } from '@/shared/stores/spectrogramStore'
import { BUILTIN_LUTS, generateLUTTexture } from '@/shared/utils/lut'

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
    const lutTextureRef = useRef<WebGLTexture | null>(null)
    const bufferRef = useRef<WebGLBuffer | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const webglSupportedRef = useRef(false)
    const { theme, amplitudeScale, refreshRate, lutMode, currentLUT, colormap } = useSettingsStore()
    const { setCanvasRef } = useSpectrogramStore()

    const spectrogramDataRef = useRef<Uint8Array[]>([])
    const maxFramesRef = useRef(15 * refreshRate)
    const currentFrameRef = useRef(0)

    // Get the current LUT based on settings
    const getCurrentLUT = useCallback(() => {
      console.log('getCurrentLUT called:', { lutMode, currentLUT, colormap })
      if (currentLUT) {
        console.log('Using current LUT:', currentLUT.name)
        return currentLUT
      }
      console.log('Using builtin LUT:', colormap)
      return BUILTIN_LUTS[colormap] || BUILTIN_LUTS['viridis']
    }, [lutMode, currentLUT, colormap])

    const colorMaps: Record<Theme, { background: [number, number, number, number] }> = {
      'japanese-a-light': { background: [1, 1, 1, 1] },
      'japanese-a-dark': { background: [0, 0, 0, 1] },
      'japanese-b-light': { background: [1, 1, 1, 1] },
      'japanese-b-dark': { background: [0, 0, 0, 1] },
      'bauhaus-light': { background: [1, 1, 1, 1] },
      'bauhaus-dark': { background: [0, 0, 0, 1] }
    }

    const checkWebGLSupport = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return false
      try {
        const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
        if (!gl) return false
        const testShader = gl.createShader(gl.VERTEX_SHADER)
        if (!testShader) return false
        gl.deleteShader(testShader)
        return true
      } catch {
        return false
      }
    }, [])

    const initWebGL = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) {
        console.error('Canvas not found')
        return false
      }
      if (!checkWebGLSupport()) {
        console.error('WebGL support check failed')
        webglSupportedRef.current = false
        return false
      }
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
      if (!gl) {
        console.error('WebGL context creation failed')
        webglSupportedRef.current = false
        return false
      }
      console.log('WebGL context created successfully')
      glRef.current = gl
      webglSupportedRef.current = true

      const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }
      `
      const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D u_texture;
        varying vec2 v_texCoord;
        
        void main() {
          vec4 texColor = texture2D(u_texture, v_texCoord);
          float intensity = texColor.r;
          
          // Simple red output for testing
          gl_FragColor = vec4(intensity, 0.0, 0.0, 1.0);
        }
      `

      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(vertexShader, vertexShaderSource)
      gl.shaderSource(fragmentShader, fragmentShaderSource)
      gl.compileShader(vertexShader)
      gl.compileShader(fragmentShader)
      
      // Check for shader compilation errors
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader))
        webglSupportedRef.current = false
        return false
      }
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader))
        webglSupportedRef.current = false
        return false
      }
      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking failed:', gl.getProgramInfoLog(program))
        webglSupportedRef.current = false
        return false
      }
      programRef.current = program

      const buffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      const vertices = new Float32Array([
        -1, -1,  0, 1,
         1, -1,  1, 1,
        -1,  1,  0, 0,
         1,  1,  1, 0,
      ])
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
      bufferRef.current = buffer

      const texture = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      textureRef.current = texture

      // Create LUT texture (simplified for now)
      const lutTexture = gl.createTexture()!
      lutTextureRef.current = lutTexture

      const positionLocation = gl.getAttribLocation(program, 'a_position')
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
      gl.enableVertexAttribArray(positionLocation)
      gl.enableVertexAttribArray(texCoordLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0)
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8)
      return true
    }, [checkWebGLSupport])

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = rect.width * pixelRatio
      canvas.height = rect.height * pixelRatio
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      console.log('SpectrogramCanvas: Resized to', rect.width, 'x', rect.height, 'pixels')
      if (webglSupportedRef.current && glRef.current) {
        glRef.current.viewport(0, 0, canvas.width, canvas.height)
        console.log('SpectrogramCanvas: WebGL viewport set to', canvas.width, 'x', canvas.height)
      }
    }, [])

    const updateTexture = useCallback(() => {
      if (!webglSupportedRef.current) return
      const gl = glRef.current
      const texture = textureRef.current
      if (!gl || !texture) return
      const data = spectrogramDataRef.current
      if (data.length === 0) {
        console.log('SpectrogramCanvas: No data to update texture')
        return
      }
      const width = data[0].length
      const height = data.length
      console.log('SpectrogramCanvas: Updating texture with', width, 'x', height, 'data')
      const imageData = new Uint8Array(width * height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x
          imageData[index] = data[y][x]
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, imageData)
      console.log('SpectrogramCanvas: Texture updated successfully')
    }, [])

    const updateLUTTexture = useCallback(() => {
      if (!webglSupportedRef.current || !lutTextureRef.current) return
      const gl = glRef.current!
      const lut = getCurrentLUT()
      console.log('Updating LUT texture for:', lut.name)
      const lutData = generateLUTTexture(lut, 256)
      
      gl.bindTexture(gl.TEXTURE_2D, lutTextureRef.current)
      // Create a 2D texture by repeating the 1D data
      const lutData2D = new Uint8Array(256 * 256 * 4)
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const srcIndex = x * 4
          const dstIndex = (y * 256 + x) * 4
          lutData2D[dstIndex] = lutData[srcIndex]     // R
          lutData2D[dstIndex + 1] = lutData[srcIndex + 1] // G
          lutData2D[dstIndex + 2] = lutData[srcIndex + 2] // B
          lutData2D[dstIndex + 3] = lutData[srcIndex + 3] // A
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData2D)
    }, [getCurrentLUT])

    const render = useCallback(() => {
      if (!webglSupportedRef.current) {
        console.warn('WebGL not supported, skipping render')
        return
      }
      const gl = glRef.current!
      const program = programRef.current!
      const colors = (colorMaps as any)[theme] || (colorMaps as any)["japanese-a-dark"]
      console.log('Rendering simple WebGL shader')
      
      gl.useProgram(program)
      
      // Set up texture
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
      gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)
      
      gl.clearColor(colors.background[0], colors.background[1], colors.background[2], colors.background[3])
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [theme])

    const animate = useCallback(() => {
      if (webglSupportedRef.current) { 
        updateTexture()
        render() 
      } else {
        console.warn('WebGL not supported in animate loop, trying 2D canvas fallback')
        // Fallback to 2D canvas if WebGL fails
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = 'red'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            console.log('Drew red rectangle on 2D canvas as fallback')
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }, [updateTexture, render])

    const addFrame = useCallback((frequencyData: Uint8Array) => {
      const data = [...spectrogramDataRef.current]
      data.unshift(frequencyData)
      if (data.length > maxFramesRef.current) { data.splice(maxFramesRef.current) }
      spectrogramDataRef.current = data
      currentFrameRef.current = data.length
      console.log('SpectrogramCanvas: Added frame, total frames:', data.length, 'frequencyData length:', frequencyData.length)
    }, [])

    const clear = useCallback(() => {
      spectrogramDataRef.current = []
      currentFrameRef.current = 0
    }, [])

    useImperativeHandle(ref, () => ({ addFrame, clear, resize: resizeCanvas, getCanvas: () => canvasRef.current }), [addFrame, clear, resizeCanvas])

    // Register with global store
    useEffect(() => {
      const canvasRefObj = {
        addFrame,
        clear,
        resize: resizeCanvas,
        getCanvas: () => canvasRef.current
      }
      console.log('SpectrogramCanvas: Registering with global store')
      setCanvasRef(canvasRefObj)
      return () => {
        console.log('SpectrogramCanvas: Unregistering from global store')
        setCanvasRef(null)
      }
    }, [addFrame, clear, resizeCanvas, setCanvasRef])

    useEffect(() => {
      console.log('SpectrogramCanvas useEffect - initWebGL starting...')
      const success = initWebGL()
      console.log('SpectrogramCanvas useEffect - initWebGL result:', success)
      if (success) { 
        resizeCanvas()
        animate() 
      } else { 
        console.error('Failed to initialize WebGL, but continuing animation loop')
        animate() 
      }
      return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
    }, [initWebGL, resizeCanvas, animate])

    // Debug: Log when component mounts
    useEffect(() => {
      console.log('SpectrogramCanvas: Component mounted')
      return () => console.log('SpectrogramCanvas: Component unmounted')
    }, [])

    useEffect(() => {
      const handleResize = () => resizeCanvas()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [resizeCanvas])

    useEffect(() => {
      maxFramesRef.current = 15 * refreshRate
      if (spectrogramDataRef.current.length > maxFramesRef.current) {
        spectrogramDataRef.current = spectrogramDataRef.current.slice(0, maxFramesRef.current)
      }
    }, [refreshRate])

    // Update LUT texture when LUT changes
    useEffect(() => {
      if (webglSupportedRef.current) {
        updateLUTTexture()
      }
    }, [lutMode, currentLUT, colormap, updateLUTTexture])

    return (
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className={className || 'w-full h-full block'}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onClick={onMouseClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ cursor: 'crosshair' }}
          data-testid="spectrogram-canvas"
        />
        {/* Debug overlay for testing */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => {
              console.log('SpectrogramCanvas: Adding test data...')
              const testData = new Uint8Array(256)
              for (let i = 0; i < 256; i++) {
                testData[i] = Math.floor((i / 255) * 255)
              }
              addFrame(testData)
            }}
            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            title="Add test data"
          >
            Test Data
          </button>
          <div className="text-xs text-white bg-black bg-opacity-50 px-1 mt-1 rounded">
            Canvas Debug
          </div>
        </div>
      </div>
    )
  }
)

SpectrogramCanvas.displayName = 'SpectrogramCanvas'


