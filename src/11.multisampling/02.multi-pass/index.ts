import { GPU } from '@/modules/webgpu/GPU'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import * as wgu from 'webgpu-utils'

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
// bind group
// =============================

function createBindGroup(offset: [number, number], color: [number, number, number]) {
  const defs = wgu.makeShaderDataDefinitions(shader)
  const view = wgu.makeStructuredView(defs.uniforms.uni)
  view.set({ offset, color })

  const uniformBuffer = device.createBuffer({
    size: view.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uniformBuffer, 0, view.arrayBuffer)

  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: uniformBuffer }],
  })
}

const bindGroup1 = createBindGroup([-0.2, -0.2], [1, 0, 0])
const bindGroup2 = createBindGroup([0.2, 0.2], [0, 0, 1])

// =============================
// render pass descriptor
// =============================
const renderPassDescriptor1: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}

const renderPassDescriptor2: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'load',
      storeOp: 'store',
    },
  ],
}

// =============================
// render
// =============================

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

  const encoder = device.createCommandEncoder()
  const msaaView = multisamplingTexture.createView()

  {
    renderPassDescriptor1.colorAttachments[0]!.view = msaaView
    const pass = encoder.beginRenderPass(renderPassDescriptor1)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup1)
    pass.draw(3)
    pass.end()
  }

  {
    renderPassDescriptor2.colorAttachments[0]!.view = msaaView
    renderPassDescriptor2.colorAttachments[0]!.resolveTarget = canvasTexture.createView()
    const pass = encoder.beginRenderPass(renderPassDescriptor2)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup2)
    pass.draw(3)
    pass.end()
  }

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
