import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { createFVertices } from './vertex'
import { mat4 } from './matrix'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: presentationFormat,
    alphaMode: 'premultiplied',
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
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      },
    ],
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
})

// =============================
// uniform
// =============================

// color, matrix
const uniformBufferSize = (4 + 16) * Float32Array.BYTES_PER_ELEMENT

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

const kColorOffset = 0
const kMatrixOffset = 4

const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)
const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)

colorValue.set([Math.random(), Math.random(), Math.random(), 1])

// =============================
// vertex
// =============================

const { vertexData, indexData, numVertices } = createFVertices()

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

const indexBuffer = device.createBuffer({
  size: indexData.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(indexBuffer, 0, indexData)

// =============================
// bind group
// =============================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
})

// =============================
// gui
// =============================

type N3 = [number, number, number]

const settings = {
  translation: [45, 100, 0] as N3,
  rotation: [40, 25, 325] as N3,
  scale: [1, 1, 1] as N3,
}

const gui = new GUI().onChange(render)
gui.add(settings.translation, 0, 0, 1000, 10).name('translation.x')
gui.add(settings.translation, 1, 0, 1000, 10).name('translation.y')
gui.add(settings.translation, 2, -1000, 1000, 10).name('translation.z')

gui.add(settings.rotation, 0, -360, 360, 1).name('rotation.x')
gui.add(settings.rotation, 1, -360, 360, 1).name('rotation.y')
gui.add(settings.rotation, 2, -360, 360, 1).name('rotation.z')

gui.add(settings.scale, 0, -5, 5, 0.1).decimals(1).name('scale.x')
gui.add(settings.scale, 1, -5, 5, 0.1).decimals(1).name('scale.y')
gui.add(settings.scale, 2, -5, 5, 0.1).decimals(1).name('scale.z')

// =============================
// render
// =============================

function render() {
  renderTarget.update()

  mat4.projection(renderTarget.size.width, renderTarget.size.height, 400, matrixValue)
  mat4.translate(matrixValue, settings.translation, matrixValue)
  mat4.rotateX(matrixValue, degToRad(settings.rotation[0]), matrixValue)
  mat4.rotateY(matrixValue, degToRad(settings.rotation[1]), matrixValue)
  mat4.rotateZ(matrixValue, degToRad(settings.rotation[2]), matrixValue)
  mat4.scale(matrixValue, settings.scale, matrixValue)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setIndexBuffer(indexBuffer, 'uint32')
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
