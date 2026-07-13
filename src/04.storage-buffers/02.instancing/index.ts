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

const kNumObjects = 100

const staticUnitSize =
  4 * 4 + // color: vec4f = 4 * 32bit = 4 * 4byte
  2 * 4 + // offset: vec2f = 2 * 32bit = 2 * 4byte
  2 * 4 // padding

const changingUnitSize = 2 * 4 // scale: vec2f = 2 * 32bit = 2 * 4byte

const staticStorageBufferSize = staticUnitSize * kNumObjects
const changingStorageBufferSize = changingUnitSize * kNumObjects

const staticStorageBuffer = device.createBuffer({
  size: staticStorageBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})

const changingStorageBuffer = device.createBuffer({
  size: changingStorageBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})

const kColorOffset = 0
const kOffsetOffset = 4
const kScaleOffset = 0

const staticStorageValues = new Float32Array(staticStorageBufferSize / 4)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  const staticOffset = i * (staticUnitSize / 4)

  staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset)
  staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset)
  // c, c, c, c, o, o, _, _

  device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues)

  return { scale: rand(0.2, 0.5) }
})

const storageValues = new Float32Array(changingStorageBufferSize / 4)

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: staticStorageBuffer },
    { binding: 1, resource: changingStorageBuffer },
  ],
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

  for (let i = 0; i < objectInfos.length; i++) {
    const scale = objectInfos[i].scale
    const offset = i * (changingUnitSize / 4)
    storageValues.set([scale / aspect, scale], offset + kScaleOffset)
    // s, s
  }
  device.queue.writeBuffer(changingStorageBuffer, 0, storageValues)

  pass.setBindGroup(0, bindGroup)
  pass.draw(3, kNumObjects)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
