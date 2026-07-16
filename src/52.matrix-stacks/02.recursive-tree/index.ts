import { degToRad } from '@/modules/common/math'
import type { Matrix, Quad, Triple, Vec3 } from '@/modules/common/types'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4 } from './matrix'
import { MatrixStack } from './MatrixStack'
import { createConeVertices, createCubeVertices } from './vertices'
import { vec3 } from './vec3'

// ==========================
// setup
// ==========================

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
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
    format: renderTarget.depthStencilFormat,
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

function createObjectInfo() {
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

function createVertices({ vertexData, numVertices }: { vertexData: Float32Array; numVertices: number }, name: string) {
  const vertexBuffer = device.createBuffer({
    label: `${name}: vertex buffer vertices`,
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexBuffer, 0, vertexData)
  return { vertexBuffer, numVertices }
}

const cubeVertices = createVertices(createCubeVertices(), 'cube')
const ornamentVertices = createVertices(createConeVertices({ radius: 20, height: 60 }), 'ornament')

// ==========================
// gui
// ==========================

const settings = {
  scale: 0.9,
  rotationX: 20,
  rotationY: 10,
  baseRotation: 0,
}

const gui = new GUI()
gui.onChange(() => render())
gui.add(settings, 'scale', 0.1, 1.2, 0.01)
gui.add(settings, 'rotationX', 0, 90, 1)
gui.add(settings, 'rotationY', 0, 90, 1)
gui.add(settings, 'baseRotation', -360, 360, 1)

// ==========================
// render
// ==========================
type ObjectContext = { pass: GPURenderPassEncoder; stack: MatrixStack; viewProjectionMatrix: Matrix }

let objectNdx = 0
const stack = new MatrixStack()

const kTreeDepth = 6
const [_kWidth, kHeight, _kDepth] = [0, 1, 2]
const kBranchPosition: Triple = [-0.5, 0, 0.5]
const kBranchSize: Triple = [20, 150, 20]

const kWhite: Quad = [1, 1, 1, 1]

function drawBranch(ctx: ObjectContext) {
  const { stack } = ctx
  stack.save().scale(kBranchSize).translate(kBranchPosition)
  drawObject(ctx, cubeVertices, stack.get(), kWhite)
  stack.restore()
}

function drawTreeLevel(ctx: ObjectContext, offset: number, treeDepth: number) {
  const { stack } = ctx
  const s = offset ? settings.scale : 1
  const y = offset ? kBranchSize[kHeight] : 0
  stack
    .save()
    .translate([0, y, 0])
    .rotateZ(offset * degToRad(settings.rotationX))
    .rotateY(Math.abs(offset) * degToRad(settings.rotationY))
    .scale([s, s, s])

  drawBranch(ctx)

  if (treeDepth > 0) {
    drawTreeLevel(ctx, -1, treeDepth - 1)
    drawTreeLevel(ctx, +1, treeDepth - 1)
  }

  if (treeDepth === 0 && offset > 0) {
    const position = vec3.getTranslation(stack.get())
    drawObject(ctx, ornamentVertices, mat4.translation(position as Triple), kWhite)
  }

  stack.restore()
}

function drawObject(ctx: ObjectContext, vertices: { vertexBuffer: GPUBuffer; numVertices: number }, matrix: Float32Array, color: Quad) {
  const { pass, viewProjectionMatrix } = ctx

  if (objectNdx === objectInfos.length) {
    objectInfos.push(createObjectInfo())
  }

  const { matrixValue, colorValue, uniformBuffer, uniformValues, bindGroup } = objectInfos[objectNdx++]

  mat4.multiply(viewProjectionMatrix, matrix, matrixValue)
  colorValue.set(color)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setVertexBuffer(0, vertices.vertexBuffer)
  pass.setBindGroup(0, bindGroup)
  pass.draw(vertices.numVertices)
}

function render() {
  // render targetの更新
  renderTarget.update()

  objectNdx = 0

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)

  // カメラマトリクスの計算
  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye: Vec3 = [0, 450, 1000]
  const target: Vec3 = [0, 450, 0]
  const up: Vec3 = [0, 1, 0]

  const viewMatrix = mat4.lookAt(eye, target, up)
  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  // オブジェクト描画
  stack.save()
  stack.rotateY(degToRad(settings.baseRotation))
  const ctx = { pass, stack, viewProjectionMatrix }
  drawTreeLevel(ctx, 0, kTreeDepth)
  stack.restore()

  pass.end()
  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
