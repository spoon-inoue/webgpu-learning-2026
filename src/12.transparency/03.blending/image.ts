const hsl = (h: number, s: number, l: number) => `hsl(${(h * 360) | 0}, ${s * 100}%, ${(l * 100) | 0}%)`

export function createDestinationImage(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createLinearGradient(0, 0, size, size)
  for (let i = 0; i <= 6; ++i) {
    gradient.addColorStop(i / 6, hsl(i / -6, 1, 0.5))
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(0, 0, 0, 255)'
  ctx.globalCompositeOperation = 'destination-out'
  ctx.rotate(Math.PI / -4)
  for (let i = 0; i < size * 2; i += 32) {
    ctx.fillRect(-size, i, size * 2, 16)
  }

  return canvas
}

// ==================================================

const hsla = (h: number, s: number, l: number, a: number) => `hsla(${(h * 360) | 0}, ${s * 100}%, ${(l * 100) | 0}%, ${a})`

export function createSourceImage(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.translate(size / 2, size / 2)

  ctx.globalCompositeOperation = 'screen'
  const numCircles = 3
  for (let i = 0; i < numCircles; ++i) {
    ctx.rotate((Math.PI * 2) / numCircles)
    ctx.save()
    ctx.translate(size / 6, 0)
    ctx.beginPath()

    const radius = size / 3
    ctx.arc(0, 0, radius, 0, Math.PI * 2)

    const gradient = ctx.createRadialGradient(0, 0, radius / 2, 0, 0, radius)
    const h = i / numCircles
    gradient.addColorStop(0.5, hsla(h, 1, 0.5, 1))
    gradient.addColorStop(1, hsla(h, 1, 0.5, 0))

    ctx.fillStyle = gradient
    ctx.fill()
    ctx.restore()
  }
  return canvas
}
