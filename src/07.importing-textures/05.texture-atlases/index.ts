import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'
import { createTextureFromImage } from './texture'
import { createCubeVertices } from './vertices'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shaderCode })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: [
      {
        arrayStride: (3 + 2) * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
          { shaderLocation: 1, offset: 12, format: 'float32x2' }, // texcoord
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
// texture
// =============================

const path = import.meta.env.BASE_URL + 'assets/images/noodles.jpg'
const texture = await createTextureFromImage(device, path, { mips: true, flipY: false })

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// =============================
// uniforms
// =============================

const uniformBufferSize = 16 * 4
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kMatrixOffset = 0

const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)

// =============================
// vertex
// =============================

const { vertexData, indexData, numVertices } = createCubeVertices()

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
  entries: [
    { binding: 0, resource: uniformBuffer },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture },
  ],
})

// =============================
// settings
// =============================

const settings = {
  rotation: [20, 20, 0],
}

const gui = new GUI()
gui.add(settings.rotation, 0, -360, 360, 1).name('rotation.x')
gui.add(settings.rotation, 1, -360, 360, 1).name('rotation.y')
gui.add(settings.rotation, 2, -360, 360, 1).name('rotation.z')

gui.onChange(render)

// =============================
// render
// =============================

function render() {
  renderTarget.update()

  mat4.perspective(degToRad(60), renderTarget.size.aspect, 0.1, 10, matrixValue)

  const view = mat4.lookAt(
    [0, 1, 5], // camera position
    [0, 0, 0], // target
    [0, 1, 0], // up
  )

  mat4.multiply(matrixValue, view, matrixValue)
  mat4.rotateX(matrixValue, degToRad(settings.rotation[0]), matrixValue)
  mat4.rotateY(matrixValue, degToRad(settings.rotation[1]), matrixValue)
  mat4.rotateZ(matrixValue, degToRad(settings.rotation[2]), matrixValue)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setIndexBuffer(indexBuffer, 'uint16')
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
