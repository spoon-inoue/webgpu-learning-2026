import { degToRad } from '@/modules/common/math'
import type { Matrix, Quad, Triple, Vec3 } from '@/modules/common/types'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4 } from './matrix'
import { createCubeVertices } from './vertices'
import { MatrixStack } from './MatrixStack'

// ==========================
// setup
// ==========================

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({
  device,
  format: presentationFormat,
  alphaMode: 'premultiplied',
})

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
        arrayStride: (3 + 1) * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
          { shaderLocation: 1, offset: 12, format: 'unorm8x4' }, // color
        ],
      },
    ],
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
  primitive: {
    cullMode: 'back',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
})

// ==========================
// objects data
// ==========================
const objectInfos: {
  uniformBuffer: GPUBuffer
  uniformValues: Float32Array
  matrixValue: Float32Array
  colorValue: Float32Array
  bindGroup: GPUBindGroup
}[] = []

function createObjectInfo(device: GPUDevice) {
  const uniformBufferSize = (16 + 4) * 4
  const uniformBuffer = device?.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / 4)

  const kMatrixOffset = 0
  const kColorOffset = 16

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: uniformBuffer }],
  })

  return { uniformBuffer, uniformValues, matrixValue, colorValue, bindGroup }
}

// ==========================
// vertex
// ==========================

const { vertexData, numVertices } = createCubeVertices()
const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// ==========================
// gui
// ==========================

const settings = {
  baseRotation: 0,
}

const gui = new GUI()
gui.onChange(() => render(device))
gui.add(settings, 'baseRotation', -360, 360, 1)

// ==========================
// render target
// ==========================

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: null as any,
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    view: null as any,
    depthClearValue: 1,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
}

let depthTexture: GPUTexture | null = null

function updateRenderTarget(device: GPUDevice) {
  const canvasTexture = context.getCurrentTexture()
  renderPassDescriptor.colorAttachments[0]!.view = canvasTexture.createView()

  if (!depthTexture || depthTexture.width !== canvasTexture.width || depthTexture.height !== canvasTexture.height) {
    depthTexture?.destroy()

    depthTexture = device.createTexture({
      size: [canvasTexture.width, canvasTexture.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }
  renderPassDescriptor.depthStencilAttachment!.view = depthTexture.createView()
}

// ==========================
// render
// ==========================

const kDrawerColor: Quad = [1, 1, 1, 1]
const kHandleColor: Quad = [0.5, 0.5, 0.5, 1]
const kCabinetColor: Quad = [0.75, 0.75, 0.75, 0.75]
const kNumDrawersPerCabinet = 4
const kNumCabinets = 5

const kDrawerSize: Triple = [40, 30, 50]
const kHandleSize: Triple = [10, 2, 2]

const [kWidth, kHeight, kDepth] = [0, 1, 2]

// prettier-ignore
const kHandlePosition: Triple = [
  (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
  kDrawerSize[kHeight] * 2 / 3,
  kHandleSize[kDepth]
]

const kDrawerSpacing = kDrawerSize[kHeight] + 3
const kCabinetSpacing = kDrawerSize[kWidth] + 10

const stack = new MatrixStack()

let objectNdx = 0
type ObjectContext = { pass: GPURenderPassEncoder; stack: MatrixStack; viewProjectionMatrix: Matrix }

function drawObject(device: GPUDevice, ctx: ObjectContext, matrix: Float32Array, color: Quad) {
  const { pass, viewProjectionMatrix } = ctx

  if (objectNdx === objectInfos.length) {
    objectInfos.push(createObjectInfo(device))
  }

  const { matrixValue, colorValue, uniformBuffer, uniformValues, bindGroup } = objectInfos[objectNdx++]

  mat4.multiply(viewProjectionMatrix, matrix, matrixValue)
  colorValue.set(color)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
}

function drawDrawer(device: GPUDevice, ctx: ObjectContext) {
  const { stack } = ctx

  stack.save()
  stack.scale(kDrawerSize)
  drawObject(device, ctx, stack.get(), kDrawerColor)
  stack.restore()

  stack.save()
  stack.translate(kHandlePosition)
  stack.scale(kHandleSize)
  drawObject(device, ctx, stack.get(), kHandleColor)
  stack.restore()
}

function drawCabinet(device: GPUDevice, ctx: ObjectContext, numDrawersPerCabinet: number) {
  const { stack } = ctx

  // prettier-ignore
  const kCabinetSize: Triple = [
    kDrawerSize[kWidth] + 6,
    kDrawerSpacing * numDrawersPerCabinet + 6,
    kDrawerSize[kDepth] + 4,
  ]

  stack.save()
  stack.scale(kCabinetSize)
  drawObject(device, ctx, stack.get(), kCabinetColor)
  stack.restore()

  for (let i = 0; i < numDrawersPerCabinet; i++) {
    stack.save()
    stack.translate([3, i * kDrawerSpacing + 5, 1])
    drawDrawer(device, ctx)
    stack.restore()
  }
}

function drawCabinets(device: GPUDevice, ctx: ObjectContext, numCabinets: number) {
  const { stack } = ctx
  for (let i = 0; i < numCabinets; i++) {
    stack.save()
    stack.translate([i * kCabinetSpacing, 0, 0])
    drawCabinet(device, ctx, kNumDrawersPerCabinet)
    stack.restore()
  }
}

function render(device: GPUDevice) {
  // render targetの更新
  updateRenderTarget(device)

  objectNdx = 0

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  // カメラマトリクスの計算
  const aspect = canvas.clientWidth / canvas.clientHeight
  const projection = mat4.perspective(degToRad(60), aspect, 1, 2000)

  const eye: Vec3 = [0, 80, 200]
  const target: Vec3 = [0, 80, 0]
  const up: Vec3 = [0, 1, 0]

  const viewMatrix = mat4.lookAt(eye, target, up)
  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  // オブジェクト描画
  stack.save()
  stack.rotateY(degToRad(settings.baseRotation))
  stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0])
  const ctx = { pass, stack, viewProjectionMatrix }
  drawCabinets(device, ctx, kNumCabinets)
  stack.restore()

  pass.end()
  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
