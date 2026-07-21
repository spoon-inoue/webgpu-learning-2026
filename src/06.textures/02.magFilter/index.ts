import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
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
// bind group
// =============================

const bindGroups = Array.from({ length: 8 }, (_, i) => {
  const sampler = device.createSampler({
    addressModeU: i & 1 ? 'repeat' : 'clamp-to-edge',
    addressModeV: i & 2 ? 'repeat' : 'clamp-to-edge',
    magFilter: i & 4 ? 'linear' : 'nearest',
  })

  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture },
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
} = {
  addressModeU: 'repeat',
  addressModeV: 'repeat',
  magFilter: 'linear',
}

const addressOptions: GPUAddressMode[] = ['repeat', 'clamp-to-edge']
const filterOptions: GPUFilterMode[] = ['nearest', 'linear']

const gui = new GUI()
gui.onChange(render)
Object.assign(gui.domElement.style, { right: '', left: '15px' })
gui.add(settings, 'addressModeU', addressOptions)
gui.add(settings, 'addressModeV', addressOptions)
gui.add(settings, 'magFilter', filterOptions)

// =============================
// render
// =============================

function render() {
  renderTarget.update()

  // prettier-ignore
  const ndx = 
    (settings.addressModeU === 'repeat' ? 1 : 0) + 
    (settings.addressModeV === 'repeat' ? 2 : 0) + 
    (settings.magFilter    === 'linear' ? 4 : 0)

  const bindGroup = bindGroups[ndx]

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(6)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
