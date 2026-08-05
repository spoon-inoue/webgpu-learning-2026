import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import * as wgu from 'webgpu-utils'
import { SkyBox } from './skybox'
import { EnvMap } from './EnvMap'

const gpu = await GPU.request()
const device = gpu.device

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: gpu.presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// ==========================================
// Texture
// ==========================================

const texture = await wgu.createTextureFromImages(
  device,
  ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((name) => `${import.meta.env.BASE_URL}assets/cubemap/${name}.jpg`),
  { mips: true, flipY: false },
)

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// ==========================================
// objects
// ==========================================

const skyBox = new SkyBox(gpu, sampler, texture)
const envMap = new EnvMap(gpu, sampler, texture)

// ==========================================
// render
// ==========================================

function render(time: number) {
  time *= 0.001

  renderTarget.update()
  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  skyBox.render(pass, time, renderTarget.size.aspect)
  envMap.render(pass, time, renderTarget.size.aspect)
  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(renderTarget.canvas)
