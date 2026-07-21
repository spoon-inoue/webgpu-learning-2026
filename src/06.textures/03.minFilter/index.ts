import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import shaderCode from './index.wgsl'
import { GUI } from 'lil-gui'

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

// =============================
// uniform
// =============================

// struct Uniforms {
//   scale: vec2f,
//   offset: vec2f,
// }
const uniformBufferSize = (2 + 2) * 4
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kScaleOffset = 0
const kOffsetOffset = 2

// =============================
// bind group
// =============================

const bindGroups = Array.from({ length: 16 }, (_, i) => {
  const sampler = device.createSampler({
    addressModeU: i & 1 ? 'repeat' : 'clamp-to-edge',
    addressModeV: i & 2 ? 'repeat' : 'clamp-to-edge',
    magFilter: i & 4 ? 'linear' : 'nearest',
    minFilter: i & 8 ? 'linear' : 'nearest',
  })

  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture },
      { binding: 2, resource: uniformBuffer },
    ],
  })
})

// =============================
// settings
// =============================

const settings: {
  addressModeU: GPUAddressMode
  addressModeV: GPUAddressMode
  magFilter: GPUFilterMode
  minFilter: GPUFilterMode
} = {
  addressModeU: 'repeat',
  addressModeV: 'repeat',
  magFilter: 'linear',
  minFilter: 'linear',
}

const addressOptions: GPUAddressMode[] = ['repeat', 'clamp-to-edge']
const filterOptions: GPUFilterMode[] = ['nearest', 'linear']

const gui = new GUI()
Object.assign(gui.domElement.style, { right: '', left: '15px' })
gui.add(settings, 'addressModeU', addressOptions)
gui.add(settings, 'addressModeV', addressOptions)
gui.add(settings, 'magFilter', filterOptions)
gui.add(settings, 'minFilter', filterOptions)

// =============================
// render
// =============================

function render(time: number) {
  renderTarget.update()

  time *= 0.001

  // prettier-ignore
  const ndx = 
    (settings.addressModeU === 'repeat' ? 1 : 0) + 
    (settings.addressModeV === 'repeat' ? 2 : 0) + 
    (settings.magFilter    === 'linear' ? 4 : 0) +
    (settings.minFilter    === 'linear' ? 8 : 0)

  const bindGroup = bindGroups[ndx]

  const scaleX = 4 / renderTarget.canvas.width
  const scaleY = 4 / renderTarget.canvas.height

  uniformValues.set([scaleX, scaleY], kScaleOffset)
  uniformValues.set([Math.sin(time * 0.25) * 0.8, -0.8], kOffsetOffset)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(6)
  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

export function createResizeObserver(device: GPUDevice, callback?: (...args: any) => void) {
  const maxTextureDimension2D = device.limits.maxTextureDimension2D
  const dpr = window.devicePixelRatio

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement
      const width = Math.trunc(entry.contentBoxSize[0].inlineSize / 64)
      const height = Math.trunc(entry.contentBoxSize[0].blockSize / 64)
      canvas.width = Math.max(1, Math.min(width * dpr, maxTextureDimension2D))
      canvas.height = Math.max(1, Math.min(height * dpr, maxTextureDimension2D))
    }
    callback?.(device)
  })
  return observer
}

createResizeObserver(device).observe(renderTarget.canvas)
