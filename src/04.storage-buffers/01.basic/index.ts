import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

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

const staticUniformBufferSize =
  4 * 4 + // color: vec4f = 4 * 32bit = 4 * 4byte
  2 * 4 + // offset: vec2f = 2 * 32bit = 2 * 4byte
  2 * 4 // padding

const uniformBufferSize = 2 * 4 // scale: vec2f = 2 * 32bit = 2 * 4byte

const kColorOffset = 0
const kOffsetOffset = 4

const kScaleOffset = 0

const kNumObjects = 100

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  // static uniform
  const staticUniformBuffer = device.createBuffer({
    label: `uniforms for obj: ${i}`,
    size: staticUniformBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  const staticUniformValues = new Float32Array(staticUniformBufferSize / 4)
  // set color
  staticUniformValues.set([rand(), rand(), rand(), 1], kColorOffset)
  // set offset
  staticUniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset)

  device.queue.writeBuffer(staticUniformBuffer, 0, staticUniformValues)

  // ---
  // changing uniform
  const uniformValues = new Float32Array(uniformBufferSize / 4)

  const uniformBuffer = device.createBuffer({
    label: `changing uniforms for obj: ${i}`,
    size: uniformBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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
    // set scale
    uniformValues.set([scale / aspect, scale], kScaleOffset)
    // device.queue.writeBuffer(uniformBuffer, kScaleOffset * 4, uniformValues, kScaleOffset, 2)
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
  }

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
