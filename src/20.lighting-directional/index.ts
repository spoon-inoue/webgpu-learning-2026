import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import shader from './index.wgsl?raw'
import { createFVertices } from './vertex'
import { degToRad } from '@/modules/common/math'
import GUI from 'lil-gui'
import { mat3, mat4, vec3 } from 'wgpu-matrix'
import { createResizeObserver } from '@/modules/webgpu/resize'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  device,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// ===========================
// pipline
// ===========================

const module = device.createShaderModule({ code: shader })

const pipline = device.createRenderPipeline({
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

// ===========================
// uniform
// ===========================

// struct Uniforms {
//   normalMatrix: mat3x3f,
//   [padding]
//   worldViewProjection: mat4x4f,
//   color: vec4f,
//   lightDirection: vec3f,
//   [padding]
// }
const unifromBufferSize = (9 + 3 + 16 + 4 + 3 + 1) * 4

const uniformBuffer = device.createBuffer({
  size: unifromBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(unifromBufferSize / 4)

const kNormalMatrixOffset = 0
const kWorldViewProjectionOffset = 12
const kColorOffset = 28
const kLightDirectionOffset = 32

const normalMatrixValue = uniformValues.subarray(kNormalMatrixOffset, kNormalMatrixOffset + 12)
const worldViewProjectionValue = uniformValues.subarray(kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16)
const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4)
const lightDirectionValue = uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3)

// ===========================
// bind group
// ===========================

const bindGroup = device.createBindGroup({
  layout: pipline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
})

// ===========================
// vertex
// ===========================

const { vertexData, numVertices } = createFVertices()

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

// ===========================
// settings
// ===========================

const settings = {
  rotation: 0,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'rotation', -360, 360, 1)

// ===========================
// render
// ===========================

function render() {
  // update uniforms
  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye = [100, 150, 200]
  const target = [0, 35, 0]
  const up = [0, 1, 0]
  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  const world = mat4.rotationY(degToRad(settings.rotation))

  mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue)

  mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue)

  colorValue.set([0.2, 1, 0.2, 1])
  lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]))

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  // draw
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setBindGroup(0, bindGroup)
  pass.draw(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
