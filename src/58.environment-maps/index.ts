import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createCubeVertices } from './vertices'
import { mat4 } from 'wgpu-matrix'
import * as wgu from 'webgpu-utils'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// ==========================================
// Pipeline
// ==========================================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: [
      {
        arrayStride: (3 + 3) * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
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

// ==========================================
// Texture
// ==========================================

const texture = await wgu.createTextureFromImages(
  device,
  ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((name) => `${import.meta.env.BASE_URL}assets/cubemap/${name}.jpg`),
  { mips: true },
)

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// ==========================================
// Uniform
// ==========================================

// struct Uniforms {
//   projection: mat4x4f,
//   view: mat4x4f,
//   world: mat4x4f,
//   cameraPosition: vec3f,
//   (padding: 4bytes)
// }

const uniformBufferSize = (16 + 16 + 16 + 3 + 1) * 4

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kProjectionOffset = 0
const kViewOffset = 16
const kWorldOffset = 32
const kCameraPositionOffset = 48

const projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16)
const viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16)
const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16)
const cameraPositionValue = uniformValues.subarray(kCameraPositionOffset, kCameraPositionOffset + 3)

// ==========================================
// Vertex
// ==========================================

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

// ==========================================
// Bind Group
// ==========================================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: uniformBuffer },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
  ],
})

// ==========================================
// render
// ==========================================

function render(time: number) {
  // update uniforms
  time *= 0.001
  mat4.perspective(60 * (Math.PI / 180), renderTarget.size.aspect, 0.1, 10, projectionValue)

  cameraPositionValue.set([0, 0, 4])
  mat4.lookAt(cameraPositionValue, [0, 0, 0], [0, 1, 0], viewValue)

  mat4.identity(worldValue)
  mat4.rotateX(worldValue, time * -0.1, worldValue)
  mat4.rotateY(worldValue, time * -0.2, worldValue)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  // draw
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setIndexBuffer(indexBuffer, 'uint16')
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(renderTarget.canvas)
