import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({
  device,
  format: presentationFormat,
})

const module = device.createShaderModule({
  label: 'our hardcoded red triangle shaders',
  code: shader,
})

const pipeline = device.createRenderPipeline({
  label: 'our hardcoded red triangle pipeline',
  layout: 'auto',
  vertex: {
    module,
    entryPoint: 'vs',
  },
  fragment: {
    module,
    entryPoint: 'fs',
    targets: [{ format: presentationFormat }],
  },
})

const renderPassDescriptor: GPURenderPassDescriptor = {
  label: 'our basic canvas renderPass',
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

  const encoder = device.createCommandEncoder({ label: 'our encoder' })

  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()

  const commandBuffer = encoder.finish()
  device.queue.submit([commandBuffer])
}

createResizeObserver(device, render).observe(canvas)
