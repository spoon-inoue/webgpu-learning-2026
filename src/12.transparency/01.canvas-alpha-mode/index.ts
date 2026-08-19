import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'

const { device, presentationFormat } = await GPU.request()

const clearValue: [number, number, number, number] = [0, 0, 0, 0]

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: presentationFormat,
    alphaMode: 'premultiplied',
    clearColor: clearValue,
  },
})

// =============================
// settings
// =============================
const color = [1, 0, 0]
const settings = {
  premultiply: false,
  color,
  alpha: 0.01,
}

const gui = new GUI().onChange(render.bind(this))
gui.add(settings, 'premultiply')
gui.add(settings, 'alpha', 0, 1, 0.01).decimals(2)
gui.addColor(settings, 'color')

// =============================
// render
// =============================

function render() {
  const encoder = device.createCommandEncoder()
  renderTarget.update()

  const { alpha } = settings
  clearValue[3] = alpha
  if (settings.premultiply) {
    clearValue[0] = color[0] * alpha
    clearValue[1] = color[1] * alpha
    clearValue[2] = color[2] * alpha
  } else {
    clearValue[0] = color[0]
    clearValue[1] = color[1]
    clearValue[2] = color[2]
  }

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
