import { GPU } from '@/modules/webgpu/GPU'
import shader from './envMap.wgsl'
import { createCubeVertices } from './envMapCubeVertex'
import { mat4 } from 'wgpu-matrix'

export class EnvMap {
  private readonly device: GPUDevice
  private readonly pipeline: GPURenderPipeline
  private readonly uniformData: {
    buffer: GPUBuffer
    views: { proj: Float32Array; view: Float32Array; world: Float32Array; cameraPosition: Float32Array }
    writeBuffer: () => void
  }
  private readonly vertexData: {
    vertexBuffer: GPUBuffer
    indexBuffer: GPUBuffer
    numVertices: number
  }
  private readonly bindGroup: GPUBindGroup

  constructor(
    private readonly gpu: GPU,
    private readonly sampler: GPUSampler,
    private readonly texture: GPUTexture,
  ) {
    this.device = gpu.device
    this.pipeline = this.createPipeline()
    this.uniformData = this.createUniformData()
    this.vertexData = this.createVertexData()
    this.bindGroup = this.createBindGroup()
  }

  private createPipeline() {
    const module = this.device.createShaderModule({ code: shader })
    return this.device.createRenderPipeline({
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
        targets: [{ format: this.gpu.presentationFormat }],
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
  }

  private createUniformData() {
    // struct Uniforms {
    //   projection: mat4x4f,
    //   view: mat4x4f,
    //   world: mat4x4f,
    //   cameraPosition: vec3f,
    // }
    const bufferSize = (16 + 16 + 16 + 3 + 1) * 4
    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformValues = new Float32Array(bufferSize / 4)

    const kProjectionOffset = 0
    const kViewOffset = 16
    const kWorldOffset = 32
    const kCameraPositionOffset = 48

    const projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16)
    const viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16)
    const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16)
    const cameraPositionValue = uniformValues.subarray(kCameraPositionOffset, kCameraPositionOffset + 3)

    return {
      buffer,
      views: {
        proj: projectionValue,
        view: viewValue,
        world: worldValue,
        cameraPosition: cameraPositionValue,
      },
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, uniformValues),
    }
  }

  private createVertexData() {
    const { vertexData, indexData, numVertices } = createCubeVertices()

    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData)

    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(indexBuffer, 0, indexData)

    return { vertexBuffer, indexBuffer, numVertices }
  }

  private createBindGroup() {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.uniformData.buffer },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.texture.createView({ dimension: 'cube' }) },
      ],
    })
  }

  render(pass: GPURenderPassEncoder, time: number, canvasAspect: number) {
    // update uniform
    const { proj, view, world, cameraPosition } = this.uniformData.views

    mat4.perspective(60 * (Math.PI / 180), canvasAspect, 0.1, 10, proj)
    cameraPosition.set([Math.cos(time * 0.1) * 5, 0, Math.sin(time * 0.1) * 5])
    mat4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0], view)

    mat4.identity(world)
    mat4.rotateX(world, time * -0.1, world)
    mat4.rotateY(world, time * -0.2, world)

    this.uniformData.writeBuffer()

    // draw
    pass.setPipeline(this.pipeline)
    pass.setVertexBuffer(0, this.vertexData.vertexBuffer)
    pass.setIndexBuffer(this.vertexData.indexBuffer, 'uint16')
    pass.setBindGroup(0, this.bindGroup)
    pass.drawIndexed(this.vertexData.numVertices)
  }
}
