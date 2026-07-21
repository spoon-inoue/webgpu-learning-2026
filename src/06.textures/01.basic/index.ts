import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shaderCode from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, clearColor: [0.3, 0.3, 0.3, 1] },
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shaderCode })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module },
  fragment: { module, targets: [{ format: presentationFormat }] },
})

// =============================
// texture
// =============================

const kTextureWidth = 5
const kTextureHeight = 7
const _ = [255, 0, 0, 255]
const y = [255, 255, 0, 255]
const b = [0, 0, 255, 255]
// prettier-ignore
const textureData = new Uint8Array([
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
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})
device.queue.writeTexture({ texture }, textureData, { bytesPerRow: kTextureWidth * 4 }, { width: kTextureWidth, height: kTextureHeight })

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
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(6)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
