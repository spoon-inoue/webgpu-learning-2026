import { GPU } from '@/modules/webgpu/GPU'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
context.configure({
  device,
  format: presentationFormat,
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
  multisample: {
    count: 4,
  },
})

// =============================
// render
// =============================
const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}

let multisamplingTexture: GPUTexture | null = null

function render() {
  const canvasTexture = context.getCurrentTexture()

  if (!multisamplingTexture || multisamplingTexture.width !== canvasTexture.width || multisamplingTexture.height !== canvasTexture.height) {
    if (multisamplingTexture) {
      multisamplingTexture.destroy()
    }

    multisamplingTexture = device.createTexture({
      format: canvasTexture.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [canvasTexture.width, canvasTexture.height],
      sampleCount: 4,
    })
  }

  renderPassDescriptor.colorAttachments[0]!.view = multisamplingTexture.createView()
  renderPassDescriptor.colorAttachments[0]!.resolveTarget = canvasTexture.createView()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
