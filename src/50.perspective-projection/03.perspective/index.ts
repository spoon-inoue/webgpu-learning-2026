import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVertices } from './vertices'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { mat4 } from './matrix'
import type { Triple } from '@/modules/common/types'

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
    cullMode: 'front',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
})

// ==========================
// uniform buffer
// ==========================

// matrix
const uniformBufferSize = 16 * 4
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kMatrixoffset = 0

const matrixValue = uniformValues.subarray(kMatrixoffset, kMatrixoffset + 16)

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
// bind group
// ==========================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
})

// ==========================
// gui
// ==========================
const settings = {
  fieldOfView: 100,
  translation: [-65, 0, -120],
  rotation: [220, 25, 325],
  scale: [1, 1, 1],
}

const gui = new GUI()
gui.onChange(() => render(device))
gui.add(settings, 'fieldOfView', 1, 179, 1)
{
  const f = gui.addFolder('translation')
  f.add(settings.translation, 0, -1000, 1000, 10).name('x')
  f.add(settings.translation, 1, -1000, 1000, 10).name('y')
  f.add(settings.translation, 2, -1400, -100, 10).name('z')
}
{
  const f = gui.addFolder('rotation')
  f.add(settings.rotation, 0, -360, 360, 1).name('x')
  f.add(settings.rotation, 1, -360, 360, 1).name('y')
  f.add(settings.rotation, 2, -360, 360, 1).name('z')
}
{
  const f = gui.addFolder('scale')
  f.add(settings.scale, 0, -5, 5, 0.1).name('x')
  f.add(settings.scale, 1, -5, 5, 0.1).name('y')
  f.add(settings.scale, 2, -5, 5, 0.1).name('z')
}

// ==========================
// render
// ==========================

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
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

  // uniformの更新
  const aspect = canvas.clientWidth / canvas.clientHeight
  mat4.perspective(degToRad(settings.fieldOfView), aspect, 1, 2000, matrixValue)
  mat4.translate(matrixValue, settings.translation as Triple, matrixValue)
  mat4.rotateX(matrixValue, degToRad(settings.rotation[0]), matrixValue)
  mat4.rotateY(matrixValue, degToRad(settings.rotation[1]), matrixValue)
  mat4.rotateZ(matrixValue, degToRad(settings.rotation[2]), matrixValue)
  mat4.scale(matrixValue, settings.scale as Triple, matrixValue)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  // 描画処理
  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(canvas)
