import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'
import { faceCanvases } from './faceTextureSource'
import { createCubeVertices } from './vertex'
import { degToRad } from '@/modules/common/math'
import * as wgu from 'webgpu-utils'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// =============================
// vertex
// =============================

const { vertexData, indexData } = createCubeVertices()

const vertex = wgu.createBuffersAndAttributesFromArrays(device, {
  position: vertexData,
  indices: indexData,
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shaderCode })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    buffers: vertex.bufferLayouts,
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

const texture = wgu.createTextureFromSources(device, faceCanvases, {
  mips: true,
  flipY: false,
  textureBindingViewDimension: 'cube',
})

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// =============================
// uniform
// =============================
const defs = wgu.makeShaderDataDefinitions(shaderCode)
const uniform = wgu.makeStructuredView(defs.uniforms.uni)

const uniformBuffer = device.createBuffer({
  size: uniform.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

// =============================
// bind group
// =============================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: uniformBuffer },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
  ],
})

// =============================
// settings
// =============================

const settings = {
  rotation: [20, 25, 0],
}

const gui = new GUI()
gui.onChange(render)
gui.add(settings.rotation, 0, -360, 360, 1).name('rotation.x')
gui.add(settings.rotation, 1, -360, 360, 1).name('rotation.y')
gui.add(settings.rotation, 2, -360, 360, 1).name('rotation.z')

// =============================
// render
// =============================

function render() {
  const matrixView = uniform.views.matrix
  mat4.perspective(60 * (Math.PI / 180), renderTarget.size.aspect, 0.1, 10, matrixView)

  const view = mat4.lookAt([0, 1, 5], [0, 0, 0], [0, 1, 0])

  mat4.multiply(matrixView, view, matrixView)
  mat4.rotateX(matrixView, degToRad(settings.rotation[0]), matrixView)
  mat4.rotateY(matrixView, degToRad(settings.rotation[1]), matrixView)
  mat4.rotateZ(matrixView, degToRad(settings.rotation[2]), matrixView)

  device.queue.writeBuffer(uniformBuffer, 0, uniform.arrayBuffer)

  renderTarget.update()

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertex.buffers[0])
  pass.setIndexBuffer(vertex.indexBuffer!, vertex.indexFormat!)
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(vertex.numElements)

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
