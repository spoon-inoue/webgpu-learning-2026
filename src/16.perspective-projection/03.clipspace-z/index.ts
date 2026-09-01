import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import shader from './index.wgsl'
import { mat4 } from './matrix'
import { createFVertices } from './vertex'

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
    cullMode: 'front',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: renderTarget.depthStencilFormat,
  },
})

// =============================
// uniform
// =============================

// matrix
const uniformBufferSize = 16 * Float32Array.BYTES_PER_ELEMENT

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

const kMatrixOffset = 0

const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)

// =============================
// vertex
// =============================

const { vertexData, numVertices } = createFVertices()

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

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
  fieldOfView: 100,
  translation: [-65, 0, -120] as N3,
  rotation: [220, 25, 325] as N3,
  scale: [1, 1, 1] as N3,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'fieldOfView', 1, 179, 1)

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

  mat4.perspective(degToRad(settings.fieldOfView), renderTarget.size.aspect, 1, 2000, matrixValue)
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
  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
