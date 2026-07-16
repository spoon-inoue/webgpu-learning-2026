import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVertices } from './vertices'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { mat4 } from './matrix'
import type { Vec3 } from '@/modules/common/types'

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
const objectInfos = Array.from({ length: 5 }, () => {
  const uniformBufferSize = 16 * 4
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / 4)

  const kMatrixOffset = 0

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: uniformBuffer }],
  })

  return { uniformBuffer, uniformValues, matrixValue, bindGroup }
})

// ==========================
// vertex
// ==========================

const { vertexData, numVertices } = createFVertices()
const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// ==========================
// gui
// ==========================
const radius = 200

const settings = {
  fieldOfView: 100,
  cameraAngle: 0,
}

const gui = new GUI()
gui.onChange(() => render(device))
gui.add(settings, 'fieldOfView', 1, 179, 1)
gui.add(settings, 'cameraAngle', -360, 360, 1)

// ==========================
// render
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

function render(device: GPUDevice) {
  // render targetの更新
  updateRenderTarget(device)

  // カメラマトリクスの計算
  const aspect = canvas.clientWidth / canvas.clientHeight
  const projection = mat4.perspective(degToRad(settings.fieldOfView), aspect, 1, 2000)

  const tempMatrix = mat4.rotationY(degToRad(settings.cameraAngle))
  mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix)

  const target: Vec3 = [radius, 0, 0] // F Position
  const eye: Vec3 = tempMatrix.slice(12, 15)
  const up: Vec3 = [0, 1, 0]

  // const cameraMatrix = mat4.cameraAim(eye, target, up)
  // const viewMatrix = mat4.inverse(cameraMatrix)

  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  // 描画処理
  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  objectInfos.forEach(({ matrixValue, uniformBuffer, uniformValues, bindGroup }, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
