import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import * as wgu from 'webgpu-utils'
import { mat3, mat4 } from 'wgpu-matrix'
import shader from './index.wgsl?raw'
import { createFVertices } from './vertex'

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

const defs = wgu.makeShaderDataDefinitions(shader)
const uniform = wgu.makeTypedArrayViews(defs.uniforms.uni.typeDefinition)

const uniformBuffer = device.createBuffer({
  size: uniform.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

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
  shininess: 30,
  limit: 15,
  aimOffsetX: -10,
  aimOffsetY: 10,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'rotation', -360, 360, 1)
gui.add(settings, 'shininess', 1, 250, 1)
gui.add(settings, 'limit', 0, 90, 1)
gui.add(settings, 'aimOffsetX', -50, 50, 1).name('aim offset x')
gui.add(settings, 'aimOffsetY', -50, 50, 1).name('aim offset y')

// ===========================
// render
// ===========================

function render() {
  // update uniforms
  const views = uniform.views

  const projection = mat4.perspective(degToRad(60), renderTarget.size.aspect, 1, 2000)

  const eye = [100, 150, 200]
  const target = [0, 35, 0]
  const up = [0, 1, 0]
  const viewMatrix = mat4.lookAt(eye, target, up)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  const world = mat4.rotationY(degToRad(settings.rotation), views.world)

  mat4.multiply(viewProjectionMatrix, world, views.worldViewProjection)

  mat3.fromMat4(mat4.transpose(mat4.inverse(world)), views.normalMatrix)

  views.color.set([0.2, 1, 0.2, 1])
  views.lightWorldPosition.set([-10, 30, 100])
  views.viewWorldPosition.set(eye)
  views.shininess[0] = settings.shininess
  // light limit
  views.limit[0] = Math.cos(degToRad(settings.limit))
  // light direction
  const mat = mat4.aim(views.lightWorldPosition, [target[0] + settings.aimOffsetX, target[1] + settings.aimOffsetY, 0], up)
  views.lightDirection.set(mat.slice(8, 11))

  device.queue.writeBuffer(uniformBuffer, 0, uniform.arrayBuffer)

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
