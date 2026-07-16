import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createFVertices } from './vertices'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'
import { mat3, mat4 } from './matrix'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import type { Vec3 } from '@/modules/common/types'
import { vec3 } from './vec3'

// ==========================
// setup
// ==========================

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { alphaMode: 'premultiplied', format: presentationFormat },
  depthStencil: { enable: true, format: 'depth24plus' },
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
    format: 'depth24plus',
  },
})

// ==========================
// uniform
// ==========================

// struct Uniforms {
//   normalMatrix: mat3x3f,
//   (padding: 12byte)
//   worldViewProjection: mat4x4f,
//   world: mat4x4f,
//   color: vec4f,
//   lightPosition: vec3f,
//   (padding: 4byte)
// }

const uniformBufferSize = (9 + 3 + 16 + 16 + 4 + 3 + 1) * 4
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kNormalMatrixOffset = 0
const kWorldViewProjectionOffset = 12
const kWorldOffset = 28
const kColorOffset = 44
const kLightPositionOffset = 48

const normalMatrixValue = uniformValues.subarray(kNormalMatrixOffset, kNormalMatrixOffset + 12)
const worldViewProjectionValue = uniformValues.subarray(kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16)
const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16)
const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)
const lightPositionValue = uniformValues.subarray(kLightPositionOffset, kLightPositionOffset + 3)

// ==========================
// bind group
// ==========================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
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
const settings = {
  rotation: 0,
}

const gui = new GUI()
gui.onChange(render)
gui.add(settings, 'rotation', -360, 360, 1)

// ==========================
// render
// ==========================

function render() {
  // update render target
  renderTarget.update()

  // calc camera matrix
  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye: Vec3 = [100, 150, 200]
  const target: Vec3 = [0, 35, 0]
  const up: Vec3 = [0, 1, 0]
  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  // set uniforms
  const world = mat4.rotationY(degToRad(settings.rotation), worldValue)
  mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue)
  mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue)

  colorValue.set([0.2, 1, 0.2, 1]) // green
  lightPositionValue.set([-10, 30, 100])

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  // draw
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
