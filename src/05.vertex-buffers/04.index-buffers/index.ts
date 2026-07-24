import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createCircleVertices } from './vertices'

const rand = (min = 0, max = 1) => {
  return Math.random() * (max - min) + min
}

// ==========================
// setup
// ==========================

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({ device, format: presentationFormat })

// ==========================
// pipeline
// ==========================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: [
      {
        // position, perVertexColor
        arrayStride: 2 * 4 + 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 4, offset: 8, format: 'unorm8x4' },
        ],
      },
      {
        // static: color, offset
        arrayStride: 4 + 2 * 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 1, offset: 0, format: 'unorm8x4' },
          { shaderLocation: 2, offset: 4, format: 'float32x2' },
        ],
      },
      {
        // changing: scale
        arrayStride: 2 * 4,
        stepMode: 'instance',
        attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x2' }],
      },
    ],
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
  primitive: {
    // cullMode: 'back',
    // frontFace: 'ccw', // 反時計回り（default）
  },
})

// ==========================
// vertex buffer
// ==========================

const kNumObjects = 100

// color, offset
const staticUnitSize = 4 + 2 * 4 // color 4bytes + offset f32 * 4bytes
// scale
const changingUnitSize = 2 * 4

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
const kOffsetOffset = 1
const kScaleOffset = 0

const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize)
const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  const staticOffsetU8 = i * staticUnitSize
  const staticOffsetF32 = staticOffsetU8 / 4

  // color
  staticVertexValuesU8.set([rand() * 255, rand() * 255, rand() * 255, 255], staticOffsetU8 + kColorOffset)
  // offset
  staticVertexValuesF32.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffsetF32 + kOffsetOffset)

  return { scale: rand(0.2, 0.5) }
})
device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32)

const vertexValues = new Float32Array(changingVertexBufferSize / 4)

// position
const { numVertices, vertexData, indexData } = createCircleVertices({ radius: 0.5, innerRadius: 0.25 })

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// index
const indexBuffer = device.createBuffer({
  size: indexData.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(indexBuffer, 0, indexData)

// ==========================
// render
// ==========================

const renderPassDescriptor: GPURenderPassDescriptor = {
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

  const aspect = canvas.width / canvas.height

  objectInfos.forEach(({ scale }, i) => {
    const offset = i * (changingUnitSize / 4)
    vertexValues.set([scale / aspect, scale], offset + kScaleOffset)
  })
  device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setVertexBuffer(1, staticVertexBuffer)
  pass.setVertexBuffer(2, changingVertexBuffer)
  pass.setIndexBuffer(indexBuffer, 'uint32')
  pass.drawIndexed(numVertices, kNumObjects)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
