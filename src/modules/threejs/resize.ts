import * as THREE from 'three'

export function createResizeObserver(renderer: THREE.WebGLRenderer, callback: () => void) {
  const gl = renderer.getContext()
  const maxTextureDimension2D = gl.getParameter(gl.MAX_TEXTURE_SIZE)

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      const w = Math.max(1, Math.min(width, maxTextureDimension2D))
      const h = Math.max(1, Math.min(height, maxTextureDimension2D))
      renderer.setSize(w, h, false)
    }
    callback()
  })
  return observer
}
