import { degToRad } from '@/modules/common/math'
import type { Matrix, Quad, Triple } from '@/modules/common/types'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4 } from './matrix'
import { SceneGraphNode } from './SceneGraphNode'
import { TRS, type TRSSource } from './TRS'
import { createCubeVertices } from './vertices'
import { TRSUIHelper } from './TRSUIHelper'

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
    format: 'depth24plus',
  },
})

// ==========================
// scene graph
// ==========================
type Vertices = {
  vertexBuffer: GPUBuffer
  numVertices: number
}

function addTRSSceneGraphNode(name: string, parent: SceneGraphNode | null, trs: TRSSource) {
  const node = new SceneGraphNode(name, new TRS(trs))
  if (parent) {
    node.setParent(parent)
  }
  return node
}

function addCubeNode(name: string, parent: SceneGraphNode | null, trs: TRSSource, color: Quad) {
  const node = addTRSSceneGraphNode(name, parent, trs)
  return addMesh(node, cubeVertices, color)
}

const objectInfos: {
  uniformBuffer: GPUBuffer
  uniformValues: Float32Array
  matrixValue: Float32Array
  colorValue: Float32Array
  bindGroup: GPUBindGroup
}[] = []

function createObjectInfo() {
  const uniformBufferSize = (16 + 4) * 4
  const uniformBuffer = device.createBuffer({
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

const meshes: { node: SceneGraphNode; vertices: Vertices; color: Quad }[] = []

function addMesh(node: SceneGraphNode, vertices: Vertices, color: Quad) {
  const mesh = { node, vertices, color }
  meshes.push(mesh)
  return mesh
}

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
const kHandleColor: Quad = [0.5, 0.5, 0.5, 1]
const kDrawerColor: Quad = [1, 1, 1, 1]
const kCabinetColor: Quad = [0.75, 0.75, 0.75, 0.75]
const kNumDrawersPerCabinet = 4
const kNumCabinets = 5

const kDrawerSize: Triple = [40, 30, 50]
const kHandleSize: Triple = [10, 2, 2]

const [kWidth, kHeight, kDepth] = [0, 1, 2]

// prettier-ignore
const kHandlePosition:Triple= [
  (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
  kDrawerSize[kHeight] * 2 / 3,
  kHandleSize[kDepth],
]

const kDrawerSpacing = kDrawerSize[kHeight] + 3
const kCabinetSpacing = kDrawerSize[kWidth] + 10

function addDrawer(parent: SceneGraphNode, drawerNdx: number) {
  const drawerName = `drawer${drawerNdx}`
  const drawer = addTRSSceneGraphNode(drawerName, parent, { translation: [3, drawerNdx * kDrawerSpacing + 5, 1] })
  addCubeNode(`${drawerName}-drawer-mesh`, drawer, { scale: kDrawerSize }, kDrawerColor)
  addCubeNode(`${drawerName}-handle-mesh`, drawer, { translation: kHandlePosition, scale: kHandleSize }, kHandleColor)
}

function addCabinet(parent: SceneGraphNode, cabinetNdx: number) {
  const cabinetName = `cabinet${cabinetNdx}`
  const cabinet = addTRSSceneGraphNode(cabinetName, parent, { translation: [cabinetNdx * kCabinetSpacing, 0, 0] })
  // prettier-ignore
  const kCabinetSize: Triple = [
    kDrawerSize[kWidth] + 6, 
    kDrawerSpacing * kNumDrawersPerCabinet + 6, 
    kDrawerSize[kDepth] + 4
  ]
  addCubeNode(`${cabinetName}-mesh`, cabinet, { scale: kCabinetSize }, kCabinetColor)

  for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
    addDrawer(cabinet, drawerNdx)
  }
}

const root = new SceneGraphNode('root')
// Add cabinets
for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
  addCabinet(root, cabinetNdx)
}

// ==========================
// draw
// ==========================
type ObjectContext = { pass: GPURenderPassEncoder; viewProjectionMatrix: Matrix }

let objectNdx = 0

function drawObject(ctx: ObjectContext, vertices: Vertices, matrix: Matrix, color: Quad) {
  const { pass, viewProjectionMatrix } = ctx
  const { vertexBuffer, numVertices } = vertices
  if (objectNdx === objectInfos.length) {
    objectInfos.push(createObjectInfo())
  }
  const { matrixValue, colorValue, uniformBuffer, uniformValues, bindGroup } = objectInfos[objectNdx++]

  mat4.multiply(viewProjectionMatrix, matrix, matrixValue)
  colorValue.set(color)

  // upload the uniform values to the uniform buffer
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setVertexBuffer(0, vertexBuffer)
  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
}

function drawMesh(ctx: ObjectContext, mesh: { node: SceneGraphNode; vertices: Vertices; color: Quad }) {
  const { node, vertices, color } = mesh
  drawObject(ctx, vertices, node.worldMatrix, color)
}

// ==========================
// gui
// ==========================

// const trsUIHelper = new TRSUIHelper()

const settings = {
  cameraRotation: -45,
}

const gui = new GUI()
gui.onChange(render)
gui.add(settings, 'cameraRotation', -180, 180, 1)
// const trsFolder = gui.addFolder('orientation')
// trsFolder.add(trsUIHelper, 'translationX', -200, 200, 1)
// trsFolder.add(trsUIHelper, 'translationY', -200, 200, 1)
// trsFolder.add(trsUIHelper, 'translationZ', -200, 200, 1)
// trsFolder.add(trsUIHelper, 'rotationX', -180, 180, 1)
// trsFolder.add(trsUIHelper, 'rotationY', -180, 180, 1)
// trsFolder.add(trsUIHelper, 'rotationZ', -180, 180, 1)
// trsFolder.add(trsUIHelper, 'scaleX', 0.1, 100, 0.1)
// trsFolder.add(trsUIHelper, 'scaleY', 0.1, 100, 0.1)
// trsFolder.add(trsUIHelper, 'scaleZ', 0.1, 100, 0.1)

// ==========================
// render
// ==========================

function render() {
  // render targetの更新
  renderTarget.update()

  objectNdx = 0

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)

  // カメラマトリクスの計算
  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  // Compute a camera matrix
  const cameraMatrix = mat4.identity()
  mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix)
  mat4.rotateY(cameraMatrix, degToRad(settings.cameraRotation), cameraMatrix)
  mat4.translate(cameraMatrix, [0, 0, 300], cameraMatrix)

  // Compute a view matrix
  const viewMatrix = mat4.inverse(cameraMatrix)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  const ctx = { pass, viewProjectionMatrix }
  root.updateWorldMatrix()
  for (const mesh of meshes) {
    drawMesh(ctx, mesh)
  }

  pass.end()
  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
