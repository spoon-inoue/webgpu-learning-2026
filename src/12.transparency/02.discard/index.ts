import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: presentationFormat,
    alphaMode: 'premultiplied',
    clearColor: [0, 0, 0, 0],
  },
})

// =============================
// pipeline
// =============================
const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
})

// =============================
// render
// =============================

function render() {
  const encoder = device.createCommandEncoder()
  renderTarget.update()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
