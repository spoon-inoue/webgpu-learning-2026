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
const _ = [255, 0, 0, 255]
const y = [255, 255, 0, 255]
const b = [0, 0, 255, 255]
// prettier-ignore
const textureData = new Uint8Array([
    _, _, _, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, y, y, _,
    b, _, _, _, _,
].flat())

// =============================
// mipmap
// =============================

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: Uint8Array, b: Uint8Array, t: number) => a.map((v, i) => lerp(v, b[i], t))
const bilinearFilter = (tl: Uint8Array, tr: Uint8Array, bl: Uint8Array, br: Uint8Array, t1: number, t2: number) => {
  const t = mix(tl, tr, t1)
  const b = mix(bl, br, t1)
  return mix(t, b, t2)
}

const createNextMipLevelRgba8Unorm = ({ data: src, width: srcWidth, height: srcHeight }: { data: Uint8Array; width: number; height: number }) => {
  const dstWidth = Math.max(1, (srcWidth / 2) | 0)
  const dstHeight = Math.max(1, (srcHeight / 2) | 0)
  const dst = new Uint8Array(dstWidth * dstHeight * 4)

  const getSrcPixel = (x: number, y: number) => {
    const offset = (y * srcWidth + x) * 4
    return src.subarray(offset, offset + 4)
  }

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      // 宛先テクセルの中心のテクスチャ座標を計算する
      const u = (x + 0.5) / dstWidth
      const v = (y + 0.5) / dstHeight
      // sourceで同じテクスチャ座標を計算する - 0.5px
      const au = u * srcWidth - 0.5
      const av = v * srcHeight - 0.5
      // sourceの左上のテクセル座標（テクスチャ座標ではない）を計算する
      const tx = au | 0
      const ty = av | 0
      // ピクセル間の混合量を計算する
      const t1 = au % 1
      const t2 = av % 1
      // 4つのピクセルを取得する
      const tl = getSrcPixel(tx, ty)
      const tr = getSrcPixel(tx + 1, ty)
      const bl = getSrcPixel(tx, ty + 1)
      const br = getSrcPixel(tx + 1, ty + 1)
      // 「サンプリングされた」結果を宛先にコピーする
      const dstOffset = (y * dstWidth + x) * 4
      dst.set(bilinearFilter(tl, tr, bl, br, t1, t2), dstOffset)
    }
  }
  return { data: dst, width: dstWidth, height: dstHeight }
}

const generateMips = (src: Uint8Array, srcWidth: number) => {
  const srcHeight = src.length / 4 / srcWidth
  // 最初のミップレベル（ベースレベル）を設定する
  let mip = { data: src, width: srcWidth, height: srcHeight }
  const mips = [mip]

  while (mip.width > 1 || mip.height > 1) {
    mip = createNextMipLevelRgba8Unorm(mip)
    mips.push(mip)
  }
  return mips
}

const mips = generateMips(textureData, kTextureWidth)

const texture = device.createTexture({
  size: [mips[0].width, mips[0].height],
  mipLevelCount: mips.length,
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})

mips.forEach(({ data, width, height }, mipLevel) => {
  device.queue.writeTexture({ texture, mipLevel }, data, { bytesPerRow: width * 4 }, { width, height })
})

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
  scale: number
} = {
  addressModeU: 'repeat',
  addressModeV: 'repeat',
  magFilter: 'linear',
  minFilter: 'linear',
  scale: 1,
}

const addressOptions: GPUAddressMode[] = ['repeat', 'clamp-to-edge']
const filterOptions: GPUFilterMode[] = ['nearest', 'linear']

const gui = new GUI()
Object.assign(gui.domElement.style, { right: '', left: '15px' })
gui.add(settings, 'addressModeU', addressOptions)
gui.add(settings, 'addressModeV', addressOptions)
gui.add(settings, 'magFilter', filterOptions)
gui.add(settings, 'minFilter', filterOptions)
gui.add(settings, 'scale', 0.5, 6, 0.1)

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

  const scaleX = (4 / renderTarget.canvas.width) * settings.scale
  const scaleY = (4 / renderTarget.canvas.height) * settings.scale

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
