import React, { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from 'react'
import { useSettingsStore } from '../../shared/stores/settingsStore'

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

    const spectrogramDataRef = useRef<Uint8Array[]>([])
    const maxFramesRef = useRef(15 * refreshRate)
    const currentFrameRef = useRef(0)

    const colorMaps = {
      dark: { background: [0,0,0,1], low: [0,0,0.2,1], mid: [1,0.2,0,1], high: [1,0.4,0,1], peak: [1,0.67,0,1] },
      light: { background: [0.98,0.98,0.98,1], low: [0,0,0.5,1], mid: [0,0.5,1,1], high: [1,0.5,0,1], peak: [1,0,0,1] },
      neon: { background: [0,0,0,1], low: [0,0,0,0], mid: [0,1,1,1], high: [1,0,1,1], peak: [1,1,0,1] },
      'high-contrast': { background: [0,0,0,1], low: [0,0,0,1], mid: [1,1,1,1], high: [1,1,1,1], peak: [1,1,1,1] }
    } as const

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
      if (!canvas) return false
      if (!checkWebGLSupport()) { webglSupportedRef.current = false; return false }
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
      if (!gl) { webglSupportedRef.current = false; return false }
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
        uniform vec4 u_lowColor; uniform vec4 u_midColor; uniform vec4 u_highColor; uniform vec4 u_peakColor;
        uniform float u_intensityScale; varying vec2 v_texCoord;
        void main() {
          vec4 texColor = texture2D(u_texture, v_texCoord);
          float intensity = texColor.r;
          if (u_intensityScale > 0.5) { intensity = log(max(intensity, 0.001)) / log(0.001); }
          vec4 color;
          if (intensity < 0.25) { color = mix(u_lowColor, u_midColor, intensity * 4.0); }
          else if (intensity < 0.5) { color = mix(u_midColor, u_highColor, (intensity - 0.25) * 4.0); }
          else if (intensity < 0.75) { color = mix(u_highColor, u_peakColor, (intensity - 0.5) * 4.0); }
          else { color = u_peakColor; }
          gl_FragColor = color;
        }
      `

      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(vertexShader, vertexShaderSource)
      gl.shaderSource(fragmentShader, fragmentShaderSource)
      gl.compileShader(vertexShader)
      gl.compileShader(fragmentShader)
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) { webglSupportedRef.current = false; return false }
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) { webglSupportedRef.current = false; return false }
      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.linkStatus || 35714)) { webglSupportedRef.current = false; return false }
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
      if (webglSupportedRef.current && glRef.current) {
        glRef.current.viewport(0, 0, canvas.width, canvas.height)
      }
    }, [])

    const updateTexture = useCallback(() => {
      if (!webglSupportedRef.current) return
      const gl = glRef.current
      const texture = textureRef.current
      if (!gl || !texture) return
      const data = spectrogramDataRef.current
      if (data.length === 0) return
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

    const render = useCallback(() => {
      if (!webglSupportedRef.current) return
      const gl = glRef.current!
      const program = programRef.current!
      const colors = (colorMaps as any)[theme] || (colorMaps as any).dark
      gl.useProgram(program)
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
      gl.clearColor(colors.background[0], colors.background[1], colors.background[2], colors.background[3])
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [theme, amplitudeScale])

    const animate = useCallback(() => {
      if (webglSupportedRef.current) { updateTexture(); render() }
      animationFrameRef.current = requestAnimationFrame(animate)
    }, [updateTexture, render])

    const addFrame = useCallback((frequencyData: Uint8Array) => {
      const data = [...spectrogramDataRef.current]
      data.unshift(frequencyData)
      if (data.length > maxFramesRef.current) { data.splice(maxFramesRef.current) }
      spectrogramDataRef.current = data
      currentFrameRef.current = data.length
    }, [])

    const clear = useCallback(() => {
      spectrogramDataRef.current = []
      currentFrameRef.current = 0
    }, [])

    useImperativeHandle(ref, () => ({ addFrame, clear, resize: resizeCanvas, getCanvas: () => canvasRef.current }), [addFrame, clear, resizeCanvas])

    useEffect(() => {
      if (initWebGL()) { resizeCanvas(); animate() } else { animate() }
      return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
    }, [initWebGL, resizeCanvas, animate])

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

    return (
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
    )
  }
)

SpectrogramCanvas.displayName = 'SpectrogramCanvas'


