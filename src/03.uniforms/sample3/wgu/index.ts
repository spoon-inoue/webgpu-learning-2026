import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import * as wgu from 'webgpu-utils'

const rand = (min = 0, max = 1) => {
  return Math.random() * (max - min) + min
}

// ==========================
// setup
// ==========================

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({ device, format: presentationFormat })

// ==========================
// pipeline
// ==========================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module },
  fragment: { module, targets: [{ format: presentationFormat }] },
})

// ==========================
// uniform buffer
// ==========================
const defs = wgu.makeShaderDataDefinitions(shader)

const kNumObjects = 100

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  // static uniform
  const staticUniformValues = wgu.makeStructuredView(defs.uniforms.ourStruct)

  const staticUniformBuffer = device.createBuffer({
    label: `uniforms for obj: ${i}`,
    size: staticUniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  staticUniformValues.set({
    color: [rand(), rand(), rand(), 1],
    offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
  })

  device.queue.writeBuffer(staticUniformBuffer, 0, staticUniformValues.arrayBuffer)

  // ---
  // changing uniform
  const uniformValues = wgu.makeStructuredView(defs.uniforms.otherStruct)

  const uniformBuffer = device.createBuffer({
    label: `changing uniforms for obj: ${i}`,
    size: uniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const bindGroup = device.createBindGroup({
    label: `bind group for obj: ${i}`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: staticUniformBuffer },
      { binding: 1, resource: uniformBuffer },
    ],
  })

  return {
    scale: rand(0.2, 0.5),
    uniformBuffer,
    uniformValues,
    bindGroup,
  }
})

// ==========================
// render
// ==========================

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}

function render(device: GPUDevice) {
  renderPassDescriptor.colorAttachments[0]!.view = context.getCurrentTexture().createView()
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)

  const aspect = canvas.width / canvas.height

  for (const { scale, bindGroup, uniformBuffer, uniformValues } of objectInfos) {
    uniformValues.set({
      scale: [scale / aspect, scale],
    })
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer)

    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
  }

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
