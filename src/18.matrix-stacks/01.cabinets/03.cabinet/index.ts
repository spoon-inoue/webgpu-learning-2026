import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4, type Matrix } from './matrix'
import { createCubeVertices } from './vertex'
import { MatrixStack } from './MatrixStack'

type N3 = [number, number, number]
type N4 = [number, number, number, number]
type DrawContext = { pass: GPURenderPassEncoder; viewProjectionMatrix: Matrix; stack: MatrixStack }

// =============================
// core
// =============================

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: presentationFormat,
    alphaMode: 'premultiplied',
  },
  depthStencil: {
    enable: true,
    format: 'depth24plus',
  },
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: [
      {
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT + 4 * Uint8Array.BYTES_PER_ELEMENT,
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
    format: renderTarget.depthStencilFormat,
  },
})

// =============================
// objects
// =============================

const objectInfos: {
  uniformBuffer: GPUBuffer
  uniformValues: Float32Array<ArrayBuffer>
  matrixValue: Float32Array<ArrayBuffer>
  colorValue: Float32Array<ArrayBuffer>
  bindGroup: GPUBindGroup
}[] = []

function creatObjectInfo() {
  const uniformBufferSize = (16 + 4) * Float32Array.BYTES_PER_ELEMENT
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

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

// =============================
// vertex
// =============================

const { vertexData, numVertices } = createCubeVertices()

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// =============================
// gui
// =============================

const settings = {
  baseRotation: 0,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'baseRotation', -360, 360, 1)

// =============================
// draw
// =============================

const kHandleColor: N4 = [0.5, 0.5, 0.5, 1]
const kDrawerColor: N4 = [1, 1, 1, 1]
const kCabinetColor: N4 = [0.75, 0.75, 0.75, 0.75]

const kNumDrawersPerCabinet = 4

const kDrawerSize: N3 = [40, 30, 50]
const kHandleSize: N3 = [10, 2, 2]

const [kWidth, kHeight, kDepth] = [0, 1, 2]

// prettier-ignore
const kHandlePosition: N3 = [
  (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2, 
  (kDrawerSize[kHeight] * 2) / 3, 
  kHandleSize[kDepth]
]

const kDrawerSpacing = kDrawerSize[kHeight] + 3

let objectNdx = 0

const stack = new MatrixStack()

function drawObject(ctx: DrawContext, matrix: Matrix, color: N4) {
  const { pass, viewProjectionMatrix } = ctx

  if (objectNdx === objectInfos.length) {
    objectInfos.push(creatObjectInfo())
  }

  const { bindGroup, colorValue, matrixValue, uniformBuffer, uniformValues } = objectInfos[objectNdx++]

  mat4.multiply(viewProjectionMatrix, matrix, matrixValue)
  colorValue.set(color)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
}

function drawDrawer(ctx: DrawContext) {
  const { stack } = ctx

  stack.save()
  stack.scale(kDrawerSize)
  drawObject(ctx, stack.get(), kDrawerColor)
  stack.restore()

  stack.save()
  stack.translate(kHandlePosition)
  stack.scale(kHandleSize)
  drawObject(ctx, stack.get(), kHandleColor)
  stack.restore()
}

function drawCabinet(ctx: DrawContext, numDrawersPetCabinet: number) {
  const { stack } = ctx

  // prettier-ignore
  const kCabinetSize: N3 = [
    kDrawerSize[kWidth] + 6,
    kDrawerSpacing * numDrawersPetCabinet + 6,
    kDrawerSize[kDepth] + 4,
  ]

  stack.save()
  stack.scale(kCabinetSize)
  drawObject(ctx, stack.get(), kCabinetColor)
  stack.restore()

  for (let i = 0; i < numDrawersPetCabinet; i++) {
    stack.save()
    stack.translate([3, i * kDrawerSpacing + 5, 1])
    drawDrawer(ctx)
    stack.restore()
  }
}

// =============================
// render
// =============================

function render() {
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye: N3 = [0, 80, 200]
  const target: N3 = [0, 80, 0]
  const up: N3 = [0, 1, 0]

  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  stack.save()
  stack.rotateY(degToRad(settings.baseRotation))
  stack.translate([kDrawerSize[kWidth] * -0.5, 0, 0])
  objectNdx = 0
  const ctx = { pass, viewProjectionMatrix, stack }
  drawCabinet(ctx, kNumDrawersPerCabinet)
  stack.restore()

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
