import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4, type Matrix } from './matrix'
import { createCubeVertices } from './vertex'
import { SceneGraphNode } from './SceneGraphNode'
import { TRS, type TRSArgs } from './TRS'

type N3 = [number, number, number]
type N4 = [number, number, number, number]
type DrawContext = { pass: GPURenderPassEncoder; viewProjectionMatrix: Matrix }
type Vertices = { vertexBuffer: GPUBuffer; numVertices: number }
type Mesh = { node: SceneGraphNode; vertices: Vertices; color: N4 }

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
// vertex
// =============================

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

// =============================
// mesh
// =============================

function addTRSSceneGraphNode(name: string, parent: SceneGraphNode | null, trs: TRSArgs) {
  const node = new SceneGraphNode(name, new TRS(trs))
  if (parent) node.setParent(parent)
  return node
}

function addCubeNode(name: string, parent: SceneGraphNode | null, trs: TRSArgs, color: N4) {
  const node = addTRSSceneGraphNode(name, parent, trs)
  return addMesh(node, cubeVertices, color)
}

const meshes: Mesh[] = []

function addMesh(node: SceneGraphNode, vertices: Vertices, color: N4) {
  const mesh = { node, vertices, color }
  meshes.push(mesh)
  return mesh
}

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

function createObjectInfo() {
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
// parameters
// =============================

const kHandleColor: N4 = [0.5, 0.5, 0.5, 1]
const kDrawerColor: N4 = [1, 1, 1, 1]
const kCabinetColor: N4 = [0.75, 0.75, 0.75, 0.75]

const kNumDrawersPerCabinet = 4
const kNumCabinets = 5

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
const kCabinetSpacing = kDrawerSize[kWidth] + 10

// =============================
// scene
// =============================
const animationNodes: SceneGraphNode[] = []

function addDrawer(parent: SceneGraphNode, drawerNdx: number, cabinetName: string) {
  const drawerName = `${cabinetName}-drawer${drawerNdx}`

  const drawer = addTRSSceneGraphNode(drawerName, parent, { translation: [3, drawerNdx * kDrawerSpacing + 5, 1] })
  // add drawer box
  addCubeNode(`${drawerName}-drawer-mesh`, drawer, { scale: kDrawerSize }, kDrawerColor)
  // add drawer handle
  addCubeNode(`${drawerName}-handle-mesh`, drawer, { translation: kHandlePosition, scale: kHandleSize }, kHandleColor)

  animationNodes.push(drawer)
}

function addCabinet(parent: SceneGraphNode, cabinetNdx: number) {
  const cabinetName = `cabinet${cabinetNdx}`

  const cabinet = addTRSSceneGraphNode(cabinetName, parent, { translation: [cabinetNdx * kCabinetSpacing, 0, 0] })

  // prettier-ignore
  const kCabinetSize: N3 = [
    kDrawerSize[kWidth] + 6,
    kDrawerSpacing * kNumDrawersPerCabinet + 6,
    kDrawerSize[kDepth] + 4,
  ]

  addCubeNode(`${cabinetName}-mesh`, cabinet, { scale: kCabinetSize }, kCabinetColor)

  for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
    addDrawer(cabinet, drawerNdx, cabinetName)
  }
}

const root = new SceneGraphNode('root')

// Add cabinets
for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
  addCabinet(root, cabinetNdx)
}

// =============================
// gui
// =============================

const nodes: SceneGraphNode[] = []

function getNodes(node: SceneGraphNode) {
  nodes.push(node)
  node.children.forEach((child) => getNodes(child))
  return node
}
getNodes(root)

const settings = {
  cameraRotation: -45,
  isRunning: false,
  nodeName: 'root',
}

const gui = new GUI()
gui.add(settings, 'cameraRotation', -180, 180, 1)
gui.add(settings, 'isRunning').name('animation')

gui
  .add(
    settings,
    'nodeName',
    nodes.map((node) => node.name),
  )
  .name('node list')
  .onChange((name: string) => showNodeGui(name))

const nodeControllers = Object.fromEntries(
  nodes.map((node) => {
    const f = gui.addFolder(node.name).hide()

    const disabled = animationNodes.includes(node)

    const tf = f.addFolder('translation')
    tf.add(node.translation, 0, -100, 100, 1).name('x').listen().disable(disabled)
    tf.add(node.translation, 1, -100, 100, 1).name('y').listen().disable(disabled)
    tf.add(node.translation, 2, -100, 100, 1).name('z').listen().disable(disabled)

    const rf = f.addFolder('rotation')
    rf.add(node.rotation, 0, -180, 180, 1).name('x')
    rf.add(node.rotation, 1, -180, 180, 1).name('y')
    rf.add(node.rotation, 2, -180, 180, 1).name('z')

    const sf = f.addFolder('scale')
    sf.add(node.scale, 0, -10, 10, 0.1).decimals(1).name('x')
    sf.add(node.scale, 1, -10, 10, 0.1).decimals(1).name('y')
    sf.add(node.scale, 2, -10, 10, 0.1).decimals(1).name('z')

    return [node.name, f]
  }),
)

function showNodeGui(name: string) {
  Object.values(nodeControllers).forEach((c) => c.hide())
  nodeControllers[name].show()
}

showNodeGui(settings.nodeName)

// =============================
// draw
// =============================

let objectNdx = 0

function drawObject(ctx: DrawContext, vertices: Vertices, matrix: Matrix, color: N4) {
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

function drawMesh(ctx: DrawContext, mesh: Mesh) {
  const { node, vertices, color } = mesh

  drawObject(ctx, vertices, node.worldMatrix, color)
}

// =============================
// render
// =============================

let then = performance.now()
let now = 0
let elapsedTime = 0

function render() {
  objectNdx = 0

  now = performance.now()

  if (settings.isRunning) {
    const deltaTime = (then - now) * 0.001
    elapsedTime += deltaTime

    animationNodes.forEach((node, i) => {
      node.translation[2] = node.srcTranslation[2] + (Math.sin(elapsedTime * 5 + i) * 0.5 + 0.5) * 20
    })
  }

  then = now

  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)

  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const cameraMatrix = mat4.identity()
  mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix)
  mat4.rotateY(cameraMatrix, degToRad(settings.cameraRotation), cameraMatrix)
  mat4.translate(cameraMatrix, [0, 0, 300], cameraMatrix)

  const viewMatrix = mat4.inverse(cameraMatrix)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  const ctx = { pass, viewProjectionMatrix }
  root.updateWorldMatrix()

  for (const mesh of meshes) {
    drawMesh(ctx, mesh)
  }

  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(renderTarget.canvas)
