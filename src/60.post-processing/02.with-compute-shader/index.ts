import { rand } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import postProcessShader from './postProcess.wgsl'
import { createCircleVertices } from './vertex'
import GUI from 'lil-gui'

const { device, presentationFormat, hasFeature } = await GPU.request('bgra8unorm-storage')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
context.configure({
  device,
  format: hasFeature('bgra8unorm-storage') ? presentationFormat : 'rgba8unorm',
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
})

// =================================
// pipeline
// =================================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: [
      {
        arrayStride: 2 * 4 + 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' }, // poistion
          { shaderLocation: 4, offset: 8, format: 'unorm8x4' }, // perVertexColor
        ],
      },
      {
        arrayStride: 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 1, offset: 0, format: 'unorm8x4' }, // color
        ],
      },
      {
        arrayStride: 4 * 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 2, offset: 0, format: 'float32x2' }, // offset
          { shaderLocation: 3, offset: 8, format: 'float32x2' }, // scale
        ],
      },
    ],
  },
  fragment: {
    module,
    targets: [{ format: 'rgba8unorm' }],
  },
})

// =================================
// vertex buffer
// =================================

const kNumObjects = 10000

const staticUnitSize = 4 // color
const changingUnitSize = 2 * 4 + 2 * 4 // offset, scale
const staticVertexBufferSize = staticUnitSize * kNumObjects
const changingVertexBufferSize = changingUnitSize * kNumObjects

const staticVertexBuffer = device.createBuffer({
  size: staticVertexBufferSize,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
const changingVertexBuffer = device.createBuffer({
  size: changingVertexBufferSize,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})

const kColorOffset = 0
const kOffsetOffset = 0
const kScaleOffset = 2

const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  const staticOffsetU8 = i * staticUnitSize
  staticVertexValuesU8.set([rand() * 255, rand() * 255, rand() * 255, 255], staticOffsetU8 + kColorOffset)

  return {
    scale: rand(0.2, 0.5),
    offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
    velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
  }
})

device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesU8)

const vertexValues = new Float32Array(changingVertexBufferSize / 4)

const { vertexData, numVertices } = createCircleVertices({ radius: 0.5, innerRadius: 0.25 })

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// =================================
// post process pipeline
// =================================

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}

// =================================
// post process pipeline
// =================================

const postProcessModule = device.createShaderModule({ code: postProcessShader })

const postProcessPipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: postProcessModule },
})

const postProcessSampler = device.createSampler({
  minFilter: 'linear',
  magFilter: 'linear',
})

// =================================
// post process uniform buffer
// =================================

// struct Uniforms {
//   effectAmount: f32,
//   bandMult: f32,
//   cellMult: f32,
//   cellBright: f32,
// }

const postProcessUniformBuffer = device.createBuffer({
  size: (1 + 1 + 1 + 1) * 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

// =================================
// post process pipeline
// =================================

let renderTarget: GPUTexture | null = null
let postProcessBindGroup: GPUBindGroup | null = null

function setupPostProcess(canvasTexture: GPUTexture) {
  if (renderTarget?.width === canvasTexture.width && renderTarget?.height === canvasTexture.height) {
    return
  }

  renderTarget?.destroy()
  renderTarget = device.createTexture({
    size: canvasTexture,
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  })
  const renderTargetView = renderTarget.createView()
  renderPassDescriptor.colorAttachments[0]!.view = renderTargetView

  postProcessBindGroup = device.createBindGroup({
    layout: postProcessPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: renderTargetView },
      { binding: 1, resource: postProcessSampler },
      { binding: 2, resource: postProcessUniformBuffer },
    ],
  })
}

function postProcess(encoder: GPUCommandEncoder, _srcTexture: GPUTexture | null, dstTexture: GPUTexture) {
  // prettier-ignore
  device.queue.writeBuffer(
    postProcessUniformBuffer, 
    0, 
    new Float32Array([
      settings.affectAmount, 
      settings.bandMult, 
      settings.cellMult, 
      settings.cellBright
    ])
  )

  const outBindGroup = device.createBindGroup({
    layout: postProcessPipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: dstTexture }],
  })

  const pass = encoder.beginComputePass()
  pass.setPipeline(postProcessPipeline)
  pass.setBindGroup(0, postProcessBindGroup)
  pass.setBindGroup(1, outBindGroup)
  // prettier-ignore
  pass.dispatchWorkgroups(
    Math.ceil(dstTexture.width / 16),
    Math.ceil(dstTexture.height / 16),
  )
  pass.end()
}

// =================================
// settings
// =================================

const settings = {
  numObjects: 200,
  affectAmount: 1,
  bandMult: 1,
  cellMult: 0.5,
  cellBright: 1,
}

const gui = new GUI()
gui.add(settings, 'affectAmount', 0, 1, 0.01)
gui.add(settings, 'bandMult', 0.01, 2, 0.01)
gui.add(settings, 'cellMult', 0, 1, 0.01)
gui.add(settings, 'cellBright', 0, 2, 0.01)

// =================================
// render
// =================================

const euclideanModulo = (x: number, a: number) => x - a * Math.floor(x / a)

let then = 0

function render(now: number) {
  now *= 0.001
  const deltaTime = now - then
  then = now

  const canvasTexture = context.getCurrentTexture()
  setupPostProcess(canvasTexture)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setVertexBuffer(1, staticVertexBuffer)
  pass.setVertexBuffer(2, changingVertexBuffer)

  const aspect = canvas.width / canvas.height

  for (let ndx = 0; ndx < settings.numObjects; ndx++) {
    const { scale, offset, velocity } = objectInfos[ndx]

    offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5
    offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5

    const off = ndx * (changingUnitSize / 4)
    vertexValues.set(offset, off + kOffsetOffset)
    vertexValues.set([scale / aspect, scale], off + kScaleOffset)
  }

  device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues, 0, settings.numObjects * (changingUnitSize / 4))

  pass.draw(numVertices, settings.numObjects)

  pass.end()

  postProcess(encoder, renderTarget, canvasTexture)

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(canvas)
