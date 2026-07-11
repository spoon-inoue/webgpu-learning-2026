import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({ device, format: presentationFormat })

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module },
  fragment: { module, targets: [{ format: presentationFormat }] },
})

// ==========================
// uniform buffer
// ==========================
const uniformBufferSize =
  4 * 4 + // color: vec4f = 4 * 32bit = 4 * 4byte
  2 * 4 + // scale: vec2f = 2 * 32bit = 2 * 4byte
  2 * 4 // offset: vec2f = 2 * 32bit = 2 * 4byte

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kColorOffset = 0
const kScaleOffset = 4
const kOffsetOffset = 6

// set color
uniformValues.set([0, 1, 0, 1], kColorOffset)
// set offset
uniformValues.set([-0.5, -0.25], kOffsetOffset)

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
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
  // set scale
  const aspect = canvas.width / canvas.height
  uniformValues.set([0.5 / aspect, 0.5], kScaleOffset)
  // write to uniform buffer
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  renderPassDescriptor.colorAttachments[0]!.view = context.getCurrentTexture().createView()

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
