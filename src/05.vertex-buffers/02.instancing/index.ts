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
        arrayStride: (2 + 3) * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 4, offset: 8, format: 'float32x3' },
        ],
      },
      {
        // static: color, offset
        arrayStride: (4 + 2) * 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 1, offset: 0, format: 'float32x4' },
          { shaderLocation: 2, offset: 16, format: 'float32x2' },
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
})

// ==========================
// vertex buffer
// ==========================

const kNumObjects = 100

// color, offset
const staticUnitSize = (4 + 2) * 4
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
const kOffsetOffset = 4
const kScaleOffset = 0

const staticVertexValues = new Float32Array(staticVertexBufferSize / 4)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  const staticOffset = i * (staticUnitSize / 4)

  staticVertexValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset)
  staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset)

  return { scale: rand(0.2, 0.5) }
})
device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValues)

const vertexValues = new Float32Array(changingVertexBufferSize / 4)

// position
const { numVertices, vertexData } = createCircleVertices({ radius: 0.5, innerRadius: 0.25 })

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

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
  pass.draw(numVertices, kNumObjects)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
