import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVertices } from './vertices'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { mat4 } from './matrix'
import type { Triple, Vec3 } from '@/modules/common/types'

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
const objectInfos = Array.from({ length: 5 * 5 + 1 }, () => {
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
  target: [0, 200, 300],
  targetAngle: 0,
}

const gui = new GUI()
gui.onChange(() => render(device))
gui.add(settings.target, 1, -100, 300, 1).name('target height')
gui.add(settings, 'targetAngle', -360, 360, 1).name('target angle')

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

  settings.target[0] = Math.cos(degToRad(settings.targetAngle)) * radius
  settings.target[2] = Math.sin(degToRad(settings.targetAngle)) * radius

  // カメラマトリクスの計算
  const aspect = canvas.clientWidth / canvas.clientHeight
  const projection = mat4.perspective(degToRad(60), aspect, 1, 2000)

  const eye: Vec3 = [-500, 300, -500]
  const target: Vec3 = [0, -100, 0]
  const up: Vec3 = [0, 1, 0]

  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  // 描画処理
  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  objectInfos.forEach(({ matrixValue, uniformBuffer, uniformValues, bindGroup }, i) => {
    const deep = 5
    const across = 5
    if (i < 25) {
      // グリッド位置を計算する
      const gridX = i % across
      const gridZ = Math.trunc(i / across)

      // 0から1の位置を計算する
      const u = gridX / (across - 1)
      const v = gridZ / (deep - 1)

      // 中央に配置して広げる
      const x = (u - 0.5) * across * 150
      const z = (v - 0.5) * deep * 150

      // このFをその位置からターゲットFに向ける
      const aimMatrix = mat4.aim([x, 0, z], settings.target as Vec3, up)
      mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue)
    } else {
      mat4.translate(viewProjectionMatrix, settings.target as Triple, matrixValue)
    }

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
