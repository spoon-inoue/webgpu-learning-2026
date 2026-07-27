const size = 256
const half = size / 2

const ctx = document.createElement('canvas').getContext('2d')!
ctx.canvas.width = size
ctx.canvas.height = size

const hsl = (h: number, s: number, l: number) => `hsl(${(h * 360) | 0}, ${s * 100}%, ${(l * 100) | 0}%)`

function update2DCanvas(time: number) {
  time *= 0.0001
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(half, half)
  const num = 20
  for (let i = 0; i < num; i++) {
    ctx.fillStyle = hsl((i / num) * 0.2 + time * 0.1, 1, (i % 2) * 0.5)
    ctx.fillRect(-half, -half, size, size)
    ctx.rotate(time * 0.5)
    ctx.scale(0.85, 0.85)
    ctx.translate(size / 16, 0)
  }
  ctx.restore()
}

export { update2DCanvas, ctx }
