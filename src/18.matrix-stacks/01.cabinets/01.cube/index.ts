import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4, type Matrix } from './matrix'
import { createCubeVertices } from './vertex'

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
// render
// =============================
let objectNdx = 0

type DrawContext = { pass: GPURenderPassEncoder; viewProjectionMatrix: Matrix }

function drawObject(ctx: DrawContext, matrix: Matrix, color: [number, number, number, number]) {
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

function render() {
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye: [number, number, number] = [0, 2, 3]
  const target: [number, number, number] = [0, 1, 0]
  const up: [number, number, number] = [0, 1, 0]

  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  objectNdx = 0
  const ctx = { pass, viewProjectionMatrix }
  drawObject(ctx, mat4.rotationY(degToRad(settings.baseRotation)), [1, 1, 1, 1])

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
