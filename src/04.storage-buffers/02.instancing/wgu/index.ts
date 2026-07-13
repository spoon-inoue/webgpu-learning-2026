import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { rand } from '@/modules/common/math'
import * as wgu from 'webgpu-utils'

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
// storage buffer
// ==========================
const kNumObjects = 100

const defs = wgu.makeShaderDataDefinitions(shader)

// ---
// static

const { size: staticStorageSize } = wgu.getSizeAndAlignmentOfUnsizedArrayElement(defs.storages.ourStructs)
const staticBufferView = wgu.makeStructuredView(defs.storages.ourStructs, new ArrayBuffer(staticStorageSize * kNumObjects))

const staticStorageBuffer = device.createBuffer({
  size: staticBufferView.arrayBuffer.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})

for (let i = 0; i < kNumObjects; i++) {
  staticBufferView.views[i].color.set([rand(), rand(), rand(), 1])
  staticBufferView.views[i].offset.set([rand(-0.9, 0.9), rand(-0.9, 0.9)])
}

device.queue.writeBuffer(staticStorageBuffer, 0, staticBufferView.arrayBuffer)

// ---
// changing

const { size: changingStorageSize } = wgu.getSizeAndAlignmentOfUnsizedArrayElement(defs.storages.otherStructs)
const changingBufferView = wgu.makeStructuredView(defs.storages.otherStructs, new ArrayBuffer(changingStorageSize * kNumObjects))

const changingStorageBuffer = device.createBuffer({
  size: changingBufferView.arrayBuffer.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})

const objectInfos = Array.from({ length: kNumObjects }, () => {
  return { scale: rand(0.2, 0.5) }
})

// ==========================
// bind group
// ==========================

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

  objectInfos.forEach((obj, i) => {
    changingBufferView.views[i].scale.set([obj.scale / aspect, obj.scale])
  })
  device.queue.writeBuffer(changingStorageBuffer, 0, changingBufferView.arrayBuffer)

  pass.setBindGroup(0, bindGroup)
  pass.draw(3, kNumObjects)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
