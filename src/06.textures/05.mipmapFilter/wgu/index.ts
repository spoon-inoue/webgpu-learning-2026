import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import { GUI } from 'lil-gui'
import * as wgu from 'webgpu-utils'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'
import type { TypedArray } from 'webgpu-utils'

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
// mipmap
// =============================
type Mip = { data: TypedArray; width: number; height: number }

const createCheckedMipmap = () => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  const levels = [
    { size: 64, color: 'rgb(128,0,255)' },
    { size: 32, color: 'rgb(0,255,0)' },
    { size: 16, color: 'rgb(255,0,0)' },
    { size: 8, color: 'rgb(255,255,0)' },
    { size: 4, color: 'rgb(0,0,255)' },
    { size: 2, color: 'rgb(0,255,255)' },
    { size: 1, color: 'rgb(255,0,255)' },
  ]
  return levels.map(({ size, color }, i) => {
    ctx.canvas.width = size
    ctx.canvas.height = size
    ctx.fillStyle = i & 1 ? '#000' : '#fff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size / 2, size / 2)
    ctx.fillRect(size / 2, size / 2, size / 2, size / 2)
    return ctx.getImageData(0, 0, size, size)
  })
}

// prettier-ignore
const createBlendedMipmap = () => {
  const w = [255, 255, 255, 255];
  const r = [255,   0,   0, 255];
  const b = [  0,  28, 116, 255];
  const y = [255, 231,   0, 255];
  const g = [ 58, 181,  75, 255];
  const a = [ 38, 123, 167, 255];
  const data = new Uint8Array([
    w, r, r, r, r, r, r, a, a, r, r, r, r, r, r, w,
    w, w, r, r, r, r, r, a, a, r, r, r, r, r, w, w,
    w, w, w, r, r, r, r, a, a, r, r, r, r, w, w, w,
    w, w, w, w, r, r, r, a, a, r, r, r, w, w, w, w,
    w, w, w, w, w, r, r, a, a, r, r, w, w, w, w, w,
    w, w, w, w, w, w, r, a, a, r, w, w, w, w, w, w,
    w, w, w, w, w, w, w, a, a, w, w, w, w, w, w, w,
    b, b, b, b, b, b, b, b, a, y, y, y, y, y, y, y,
    b, b, b, b, b, b, b, g, y, y, y, y, y, y, y, y,
    w, w, w, w, w, w, w, g, g, w, w, w, w, w, w, w,
    w, w, w, w, w, w, r, g, g, r, w, w, w, w, w, w,
    w, w, w, w, w, r, r, g, g, r, r, w, w, w, w, w,
    w, w, w, w, r, r, r, g, g, r, r, r, w, w, w, w,
    w, w, w, r, r, r, r, g, g, r, r, r, r, w, w, w,
    w, w, r, r, r, r, r, g, g, r, r, r, r, r, w, w,
    w, r, r, r, r, r, r, g, g, r, r, r, r, r, r, w,
  ].flat());
  return { data, width: 16 };
}

const createTextureWithMips = (mips: Mip[], label: string) => {
  const texture = device.createTexture({
    label,
    size: [mips[0].width, mips[0].height],
    mipLevelCount: mips.length,
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
  // prettier-ignore
  mips.forEach(({ data, width, height }, mipLevel) => {
    device.queue.writeTexture(
      { texture, mipLevel }, 
      data, 
      { bytesPerRow: width * 4 }, 
      { width, height }
    )
  })
  return texture
}

// prettier-ignore
const textures = [
  wgu.createTextureFromSource(device, createBlendedMipmap(), { mips: true }),
  createTextureWithMips(createCheckedMipmap(), 'checker'),
]

const kMatrixOffset = 0

const objectInfos = Array.from({ length: 8 }, (_, i) => {
  const sampler = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: i & 1 ? 'linear' : 'nearest',
    minFilter: i & 2 ? 'linear' : 'nearest',
    mipmapFilter: i & 4 ? 'linear' : 'nearest',
  })

  const uniformBufferSize = 16 * 4
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / 4)
  const matrix = uniformValues.subarray(kMatrixOffset, 16)

  const bindGroups = textures.map((texture) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture },
        { binding: 2, resource: uniformBuffer },
      ],
    }),
  )

  return { bindGroups, matrix, uniformValues, uniformBuffer }
})

// =============================
// settings
// =============================

let texNdx = 0

const settings = {
  switch: () => {
    texNdx = ++texNdx % 2
  },
}

const gui = new GUI()
gui.onChange(render)
gui.add(settings, 'switch')

// =============================
// render
// =============================

function render() {
  const fov = 60 * (Math.PI / 180)
  const aspect = renderTarget.canvas.clientWidth / renderTarget.canvas.clientHeight
  const zNear = 1
  const zFar = 2000
  const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar)

  const cameraPosition = [0, 0, 2]
  const up = [0, 1, 0]
  const target = [0, 0, 0]
  const viewMatrix = mat4.lookAt(cameraPosition, target, up)
  const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix)

  renderTarget.update()

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)

  objectInfos.forEach(({ bindGroups, matrix, uniformBuffer, uniformValues }, i) => {
    const bindGroup = bindGroups[texNdx]

    const xSpacing = 1.2
    const ySpacing = 0.7
    const zDepth = 50

    const x = (i % 4) - 1.5
    const y = i < 4 ? 1 : -1

    mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix)
    mat4.rotateX(matrix, 0.5 * Math.PI, matrix)
    mat4.scale(matrix, [1, zDepth * 2, 1], matrix)
    mat4.translate(matrix, [-0.5, -0.5, 0], matrix)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
    pass.setBindGroup(0, bindGroup)
    pass.draw(6)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
