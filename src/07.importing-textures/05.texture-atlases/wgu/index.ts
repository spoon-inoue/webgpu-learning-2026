import { degToRad } from '@/modules/common/math'
import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import * as wgu from 'webgpu-utils'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'
import { createCubeVertices } from './vertices'

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

const { positionData, texcoordData, indexData } = createCubeVertices()

const vertex = wgu.createBuffersAndAttributesFromArrays(device, {
  position: positionData,
  texcoord: texcoordData,
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

const path = import.meta.env.BASE_URL + 'assets/images/noodles.jpg'
const texture = await wgu.createTextureFromImage(device, path, { mips: true, flipY: false })

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// =============================
// uniforms
// =============================

const defs = wgu.makeShaderDataDefinitions(shaderCode)
const uniforms = wgu.makeStructuredView(defs.uniforms.uni)

const uniformBuffer = device.createBuffer({
  size: uniforms.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const matrixValue = uniforms.views.matrix

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

  device.queue.writeBuffer(uniformBuffer, 0, uniforms.arrayBuffer)

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
