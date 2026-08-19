import { GPU } from '@/modules/webgpu/GPU'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import * as wgu from 'webgpu-utils'
import { mat4 } from 'wgpu-matrix'
import { createDestinationImage, createSourceImage } from './image'
import shader from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!

// =============================
// images
// =============================
const size = 300
const srcCanvas = createSourceImage(size)
const dstCanvas = createDestinationImage(size)

// =============================
// module
// =============================
const module = device.createShaderModule({ code: shader })

// =============================
// bind group layout
// =============================
const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} },
  ],
})

// =============================
// pipeline layout
// =============================
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [bindGroupLayout],
})

// =============================
// textures
// =============================
const srcTextureUnpremultipliedAlpha = wgu.createTextureFromSource(device, srcCanvas, { mips: true })
const dstTextureUnpremultipliedAlpha = wgu.createTextureFromSource(device, dstCanvas, { mips: true })

const srcTexturePremultipliedAlpha = wgu.createTextureFromSource(device, srcCanvas, { mips: true, premultipliedAlpha: true })
const dstTexturePremultipliedAlpha = wgu.createTextureFromSource(device, dstCanvas, { mips: true, premultipliedAlpha: true })

// =============================
// sampler
// =============================
const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// =============================
// uniform
// =============================
type Unifrom = {
  buffer: GPUBuffer
  values: Float32Array
  matrix: Float32Array
}

function makeUniformBufferAndValues(): Unifrom {
  const kMatrixOffset = 0
  const uniformBufferSize = 16 * 4

  const values = new Float32Array(uniformBufferSize / 4)
  const matrix = values.subarray(kMatrixOffset, 16)

  const buffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  return { buffer, values, matrix }
}

const srcUniform = makeUniformBufferAndValues()
const dstUniform = makeUniformBufferAndValues()

// =============================
// bind group
// =============================
function createBindGroup(texture: GPUTexture, buffer: GPUBuffer) {
  return device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture },
      { binding: 2, resource: { buffer } },
    ],
  })
}

const srcBindGroupUnpremultipliedAlpha = createBindGroup(srcTextureUnpremultipliedAlpha, srcUniform.buffer)
const dstBindGroupUnpremultipliedAlpha = createBindGroup(dstTextureUnpremultipliedAlpha, dstUniform.buffer)
const srcBindGroupPremultipliedAlpha = createBindGroup(srcTexturePremultipliedAlpha, srcUniform.buffer)
const dstBindGroupPremultipliedAlpha = createBindGroup(dstTexturePremultipliedAlpha, dstUniform.buffer)

// =============================
// render pass descriptor
// =============================
const clearValue: [number, number, number, number] = [0, 0, 0, 0]

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      clearValue,
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}

// =============================
// settings
// =============================
const textureSets = [
  {
    srcTexture: srcTexturePremultipliedAlpha,
    dstTexture: dstTexturePremultipliedAlpha,
    srcBindGroup: srcBindGroupPremultipliedAlpha,
    dstBindGroup: dstBindGroupPremultipliedAlpha,
  },
  {
    srcTexture: srcTextureUnpremultipliedAlpha,
    dstTexture: dstTextureUnpremultipliedAlpha,
    srcBindGroup: srcBindGroupUnpremultipliedAlpha,
    dstBindGroup: dstBindGroupUnpremultipliedAlpha,
  },
]

// prettier-ignore
const operations: GPUBlendOperation[] = [
  'add',
  'subtract',
  'reverse-subtract',
  'min',
  'max',
]

const factors: GPUBlendFactor[] = [
  'zero',
  'one',
  'src',
  'one-minus-src',
  'src-alpha',
  'one-minus-src-alpha',
  'dst',
  'one-minus-dst',
  'dst-alpha',
  'one-minus-dst-alpha',
  'src-alpha-saturated',
  'constant',
  'one-minus-constant',
]

const presets = {
  'default (copy)': {
    color: {
      operation: 'add',
      srcFactor: 'one',
      dstFactor: 'zero',
    },
  },
  'premultiplied blend (source-over)': {
    color: {
      operation: 'add',
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
    },
  },
  'un-premultiplied blend': {
    color: {
      operation: 'add',
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
    },
  },
  'destination-over': {
    color: {
      operation: 'add',
      srcFactor: 'one-minus-dst-alpha',
      dstFactor: 'one',
    },
  },
  'source-in': {
    color: {
      operation: 'add',
      srcFactor: 'dst-alpha',
      dstFactor: 'zero',
    },
  },
  'destination-in': {
    color: {
      operation: 'add',
      srcFactor: 'zero',
      dstFactor: 'src-alpha',
    },
  },
  'source-out': {
    color: {
      operation: 'add',
      srcFactor: 'one-minus-dst-alpha',
      dstFactor: 'zero',
    },
  },
  'destination-out': {
    color: {
      operation: 'add',
      srcFactor: 'zero',
      dstFactor: 'one-minus-src-alpha',
    },
  },
  'source-atop': {
    color: {
      operation: 'add',
      srcFactor: 'dst-alpha',
      dstFactor: 'one-minus-src-alpha',
    },
  },
  'destination-atop': {
    color: {
      operation: 'add',
      srcFactor: 'one-minus-dst-alpha',
      dstFactor: 'src-alpha',
    },
  },
  'additive (lighten)': {
    color: {
      operation: 'add',
      srcFactor: 'one',
      dstFactor: 'one',
    },
  },
}

const color: GPUBlendComponent = {
  operation: 'add',
  srcFactor: 'one',
  dstFactor: 'one-minus-src',
}

const alpha: GPUBlendComponent = {
  operation: 'add',
  srcFactor: 'one',
  dstFactor: 'one-minus-src',
}

const constant = {
  color: [1, 0.5, 0.25],
  alpha: 1,
}

const clear = {
  color: [0, 0, 0],
  alpha: 0,
  premultiply: true,
}

type TextureSet = 'premultiplied alpha' | 'un-premultiplied alpha'

const settings: { alphaMode: GPUCanvasAlphaMode; textureSet: TextureSet; preset: string } = {
  alphaMode: 'premultiplied',
  textureSet: 'premultiplied alpha',
  preset: 'default (copy)',
}

const gui = new GUI().onChange(render)
gui.add(settings, 'alphaMode', ['opaque', 'premultiplied']).name('canvas alphaMode')
gui.add(settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha'])
gui
  .add(settings, 'preset', Object.keys(presets))
  .name('blending preset')
  .onChange((presetName: keyof typeof presets) => {
    const preset = presets[presetName]
    Object.assign(color, preset.color)
    // Object.assign(alpha, preset.alpha || preset.color)
    Object.assign(alpha, preset.color)
  })

const colorFolder = gui.addFolder('color')
colorFolder.add(color, 'operation', operations).listen()
colorFolder.add(color, 'srcFactor', factors).listen()
colorFolder.add(color, 'dstFactor', factors).listen()

const alphaFolder = gui.addFolder('alpha')
alphaFolder.add(alpha, 'operation', operations).listen()
alphaFolder.add(alpha, 'srcFactor', factors).listen()
alphaFolder.add(alpha, 'dstFactor', factors).listen()

const constantFolder = gui.addFolder('constant')
constantFolder.addColor(constant, 'color')
constantFolder.add(constant, 'alpha', 0, 1)

const clearFolder = gui.addFolder('clear color')
clearFolder.add(clear, 'premultiply')
clearFolder.add(clear, 'alpha', 0, 1)
clearFolder.addColor(clear, 'color')

// =============================
// pipeline
// =============================
const dstPipeline = device.createRenderPipeline({
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
// render
// =============================
function makeBlendComponentValid(blend: GPUBlendComponent) {
  const { operation } = blend
  if (operation === 'min' || operation === 'max') {
    blend.srcFactor = 'one'
    blend.dstFactor = 'one'
  }
}

function getTextureSetIndex() {
  return settings.textureSet === 'premultiplied alpha' ? 0 : 1
}

function render() {
  makeBlendComponentValid(color)
  makeBlendComponentValid(alpha)

  const srcPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module },
    fragment: {
      module,
      targets: [
        {
          format: presentationFormat,
          blend: { color, alpha },
        },
      ],
    },
  })

  const { srcTexture, dstTexture, srcBindGroup, dstBindGroup } = textureSets[getTextureSetIndex()]

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: settings.alphaMode,
  })

  const canvasTexture = context.getCurrentTexture()
  renderPassDescriptor.colorAttachments[0]!.view = canvasTexture.createView()

  {
    const { alpha, color, premultiply } = clear
    const mult = premultiply ? alpha : 1
    clearValue[0] = color[0] * mult
    clearValue[1] = color[1] * mult
    clearValue[2] = color[2] * mult
    clearValue[3] = alpha
  }

  const updateUniforms = (uniform: Unifrom, canvasTexture: GPUTexture, texture: GPUTexture) => {
    const projectionMatrix = mat4.ortho(0, canvasTexture.width, canvasTexture.height, 0, -1, 1)
    mat4.scale(projectionMatrix, [texture.width, texture.height, 1], uniform.matrix)
    device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
  }
  updateUniforms(srcUniform, canvasTexture, srcTexture)
  updateUniforms(dstUniform, canvasTexture, dstTexture)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)

  pass.setPipeline(dstPipeline)
  pass.setBindGroup(0, dstBindGroup)
  pass.draw(6)

  pass.setPipeline(srcPipeline)
  pass.setBindGroup(0, srcBindGroup)
  pass.setBlendConstant([...constant.color, constant.alpha])
  pass.draw(6)

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
