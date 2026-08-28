import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVerticies } from './vertex'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { mat3 } from './matrix'

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
        arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
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

// color, resolution, [padding], matrix, [matrix padding]
const uniformBufferSize = (4 + 2 + 2 + 9 + 3) * Float32Array.BYTES_PER_ELEMENT

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

const kColorOffset = 0
const kResolutionOffset = 4
const kMatrixOffset = 8

const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)
const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2)
const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12)

colorValue.set([Math.random(), Math.random(), Math.random(), 1])

// =============================
// vertex
// =============================

const { vertexData, indexData, numVertices } = createFVerticies()

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

const settings = {
  translation: [150, 100] as [number, number],
  rotation: 30,
  scale: [1, 1] as [number, number],
}

const gui = new GUI().onChange(render)
gui.add(settings.translation, 0, 0, 1000, 10).name('translation.x')
gui.add(settings.translation, 1, 0, 1000, 10).name('translation.y')
gui.add(settings, 'rotation', -360, 360, 1).name('rotation')
gui.add(settings.scale, 0, -5, 5, 0.1).decimals(1).name('scale.x')
gui.add(settings.scale, 1, -5, 5, 0.1).decimals(1).name('scale.y')

// =============================
// render
// =============================

function render() {
  const encoder = device.createCommandEncoder()
  renderTarget.update()

  resolutionValue.set([renderTarget.resolution.width, renderTarget.resolution.height])

  const translationMatrix = mat3.translation(settings.translation)
  const rotationMatrix = mat3.rotation(degToRad(settings.rotation))
  const scaleMatrix = mat3.scaling(settings.scale)

  let matrix = mat3.multiply(translationMatrix, rotationMatrix)
  matrix = mat3.multiply(matrix, scaleMatrix)

  // prettier-ignore
  matrixValue.set([
    ...matrix.slice(0, 3), 0,
    ...matrix.slice(3, 6), 0,
    ...matrix.slice(6, 9), 0,
  ])

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

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
