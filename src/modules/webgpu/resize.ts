export function createResizeObserver(device: GPUDevice, callback?: (...args: any) => void) {
  const maxTextureDimension2D = device.limits.maxTextureDimension2D
  const dpr = window.devicePixelRatio

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      canvas.width = Math.max(1, Math.min(width * dpr, maxTextureDimension2D))
      canvas.height = Math.max(1, Math.min(height * dpr, maxTextureDimension2D))
    }
    callback?.(device)
  })
  return observer
}
