import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import * as wgu from 'webgpu-utils'

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({ device, format: presentationFormat })

// ==========================
//  pipeline
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
const uniformValues = wgu.makeStructuredView(defs.uniforms.ourStruct)

const uniformBuffer = device.createBuffer({
  size: uniformValues.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

uniformValues.set({
  color: [0, 1, 0, 1],
  offset: [-0.5, -0.25],
})

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

  uniformValues.set({
    scale: [0.5 / aspect, 0.5],
  })

  // write to uniform buffer
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer)

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
