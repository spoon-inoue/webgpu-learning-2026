import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createCircleVertices } from './vertices'
import * as wgu from 'webgpu-utils'

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
// vertex buffer
// ==========================

const kNumObjects = 100

const staticVertexColorValues = new Uint8Array(4 * kNumObjects)
const staticVertexOffsetValues = new Float32Array(2 * kNumObjects)
const changingVertexScaleValues = new Float32Array(2 * kNumObjects)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  // color
  staticVertexColorValues.set([rand() * 255, rand() * 255, rand() * 255, 255], i * 4)
  // offset
  staticVertexOffsetValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], i * 2)
  // scale
  return { scale: rand(0.2, 0.5) }
})

const { vertexData, colorData, indexData } = createCircleVertices({ radius: 0.5, innerRadius: 0.25 })

/*
 * For attribute formats, guesses are made based on type and number of components. The guess is
 * based on this table where (d) is the default for that type if `normalize` is not specified
 *
 * | Type          |     ..      | normalize   |
 * | ------------  | ----------- | ----------- |
 * | Int8Array     | sint8       | snorm8 (d)  |
 * | Uint8Array    | uint8       | unorm8 (d)  |
 * | Int16Array    | sint16      | snorm16 (d) |
 * | Uint16Array   | uint16      | unorm16 (d) |
 * | Int32Array    | sint32 (d)  | snorm32     |
 * | Uint32Array   | uint32 (d)  | unorm32     |
 * | Float16Array  | float16 (d) | float16     |
 * | Float32Array  | float32 (d) | float32     |
 */

// position, perVertexColor
const vertexAttributes = wgu.createBuffersAndAttributesFromArrays(device, {
  position: { data: vertexData, numComponents: 2 },
  perVertexColor: { data: colorData, numComponents: 4 },
  indices: indexData,
})

// color, offset
const instanceStaticAttributes = wgu.createBuffersAndAttributesFromArrays(
  device,
  {
    color: { data: staticVertexColorValues, numComponents: 4 } as wgu.FullArraySpec,
    offset: { data: staticVertexOffsetValues, numComponents: 2 },
  },
  { stepMode: 'instance', shaderLocation: 2 },
)

// scale
const instanceChangingAttributes = wgu.createBuffersAndAttributesFromArrays(
  device,
  { scale: { data: changingVertexScaleValues, numComponents: 2 } },
  { stepMode: 'instance', shaderLocation: 4, usage: GPUBufferUsage.COPY_DST },
)

// ==========================
// pipeline
// ==========================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    // prettier-ignore
    buffers: [
      ...vertexAttributes.bufferLayouts,
      ...instanceStaticAttributes.bufferLayouts,
      ...instanceChangingAttributes.bufferLayouts,
    ],
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
})

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
    changingVertexScaleValues.set([scale / aspect, scale], i * 2)
  })
  device.queue.writeBuffer(instanceChangingAttributes.buffers[0], 0, changingVertexScaleValues)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexAttributes.buffers[0])
  pass.setVertexBuffer(1, instanceStaticAttributes.buffers[0])
  pass.setVertexBuffer(2, instanceChangingAttributes.buffers[0])
  pass.setIndexBuffer(vertexAttributes.indexBuffer!, vertexAttributes.indexFormat!)
  pass.drawIndexed(vertexAttributes.numElements, kNumObjects)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
