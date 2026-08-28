import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVerticies } from './vertex'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'

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

// color, resolution, translation, rotation, padding
const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * Float32Array.BYTES_PER_ELEMENT

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

const kColorOffset = 0
const kResolutionOffset = 4
const kTranslationOffset = 6
const kRotationOffset = 8

const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)
const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2)
const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2)
const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2)

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
  translation: [150, 100],
  rotation: 30,
}

const gui = new GUI().onChange(render)
gui.add(settings.translation, 0, 0, 1000, 10).name('translation.x')
gui.add(settings.translation, 1, 0, 1000, 10).name('translation.y')
gui.add(settings, 'rotation', -360, 360, 1).name('rotation')

// =============================
// render
// =============================

function render() {
  const encoder = device.createCommandEncoder()
  renderTarget.update()

  resolutionValue.set([renderTarget.resolution.width, renderTarget.resolution.height])
  translationValue.set(settings.translation)
  rotationValue.set([Math.cos(degToRad(settings.rotation)), Math.sin(degToRad(settings.rotation))])
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
