export function createResizeObserver(device: GPUDevice, callback: (...args: any) => void) {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      const dpr = window.devicePixelRatio
      canvas.width = Math.max(1, Math.min(width * dpr, device.limits.maxTextureDimension2D))
      canvas.height = Math.max(1, Math.min(height * dpr, device.limits.maxTextureDimension2D))
    }
    callback(device)
  })
  return observer
}
