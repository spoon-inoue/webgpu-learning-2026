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
    cullMode: 'back',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: renderTarget.depthStencilFormat,
  },
})

// =============================
// objects
// =============================

const objectInfos = Array.from({ length: 5 }, () => {
  // matrix
  const uniformBufferSize = 16 * Float32Array.BYTES_PER_ELEMENT
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / Float32Array.BYTES_PER_ELEMENT)

  const kMatrixOffset = 0

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16)

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: uniformBuffer }],
  })

  return { uniformBuffer, uniformValues, matrixValue, bindGroup }
})

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
// gui
// =============================

const radius = 200

const settings = {
  fieldOfView: 100,
  cameraAngle: 0,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'fieldOfView', 1, 179, 1)
gui.add(settings, 'cameraAngle', -360, 360, 1)

// =============================
// render
// =============================

function render() {
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  const projection = mat4.perspective(degToRad(settings.fieldOfView), renderTarget.size.aspect, 1, 2000)

  const cameraMatrix = mat4.identity()
  mat4.rotateY(cameraMatrix, degToRad(settings.cameraAngle), cameraMatrix)
  mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix)

  const viewMatrix = mat4.inverse(cameraMatrix)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  objectInfos.forEach(({ bindGroup, matrixValue, uniformBuffer, uniformValues }, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
