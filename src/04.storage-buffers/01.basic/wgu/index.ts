import { rand } from '@mod/common/math'
import { createResizeObserver } from '@mod/webgpu/resize'
import shader from './index.wgsl'
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
const defs = wgu.makeShaderDataDefinitions(shader)

const kNumObjects = 100

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  // static storage
  const staticBufferView = wgu.makeStructuredView(defs.storages.ourStruct)

  const staticBuffer = device.createBuffer({
    size: staticBufferView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  staticBufferView.set({
    color: [rand(), rand(), rand(), 1],
    offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
  })

  device.queue.writeBuffer(staticBuffer, 0, staticBufferView.arrayBuffer)

  // ---
  // changing storage
  const changingBufferView = wgu.makeStructuredView(defs.storages.otherStruct)

  const changingBuffer = device.createBuffer({
    label: `changing uniforms for obj: ${i}`,
    size: changingBufferView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  // ---
  // bind group
  const bindGroup = device.createBindGroup({
    label: `bind group for obj: ${i}`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: staticBuffer },
      { binding: 1, resource: changingBuffer },
    ],
  })

  return {
    scale: rand(0.2, 0.5),
    changingBuffer,
    changingBufferView,
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

  for (const { scale, bindGroup, changingBuffer, changingBufferView } of objectInfos) {
    // set scale
    changingBufferView.set({
      scale: [scale / aspect, scale],
    })
    device.queue.writeBuffer(changingBuffer, 0, changingBufferView.arrayBuffer)

    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
  }

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
