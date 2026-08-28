import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: presentationFormat,
    clearColor: [0.3, 0.3, 0.3, 1],
  },
})

// =============================
// bind group layout
// =============================

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'non-filtering' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float', viewDimension: '2d', multisampled: false } },
  ],
})

// =============================
// pipeline layout
// =============================

const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [bindGroupLayout],
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module,
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
})

// =============================
// texture
// =============================

const kTextureWidth = 5
const kTextureHeight = 7
const _ = [1, 0, 0, 1] // red
const y = [1, 1, 0, 1] // yellow
const b = [0, 0, 1, 1] // blue
// prettier-ignore
const textureData = new Float32Array([
  b, _, _, _, _,
  _, y, y, y, _,
  _, y, _, _, _,
  _, y, y, _, _,
  _, y, _, _, _,
  _, y, _, _, _,
  _, _, _, _, _,
].flat())

const texture = device.createTexture({
  size: [kTextureWidth, kTextureHeight],
  format: 'rgba32float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})

// prettier-ignore
device.queue.writeTexture(
  { texture },
  textureData,
  { bytesPerRow: kTextureWidth * 4 * Float32Array.BYTES_PER_ELEMENT },
  { width: kTextureWidth, height: kTextureHeight }
)

const sampler = device.createSampler()

// =============================
// bind group
// =============================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: sampler },
    { binding: 1, resource: texture },
  ],
})

// =============================
// render
// =============================

function render() {
  const encoder = device.createCommandEncoder()
  renderTarget.update()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(6)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
