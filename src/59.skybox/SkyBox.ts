import { GPU } from '@/modules/webgpu/GPU'
import shader from './skyBox.wgsl'
import { mat4 } from 'wgpu-matrix'

export class SkyBox {
  private readonly device: GPUDevice
  private readonly pipeline: GPURenderPipeline
  private readonly uniformData: {
    buffer: GPUBuffer
    view: Float32Array<ArrayBuffer>
    writeBuffer: () => void
  }
  private readonly bindGroup: GPUBindGroup

  constructor(
    private readonly gpu: GPU,
    private readonly sampler: GPUSampler,
    private readonly texture: GPUTexture,
  ) {
    this.device = this.gpu.device
    this.pipeline = this.createPipeline()
    this.uniformData = this.createUniformData()
    this.bindGroup = this.createBindGroup()
  }

  private createPipeline() {
    const module = this.device.createShaderModule({ code: shader })
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [{ format: this.gpu.presentationFormat }],
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: 'depth24plus',
      },
    })
  }

  private createUniformData() {
    // struct Uniforms {
    //   viewDirectionProjectionInverse: mat4x4f,
    // }
    const bufferSize = 16 * 4
    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformValues = new Float32Array(bufferSize / 4)

    const kViewDirectionProjectionInverseOffset = 0
    const view = uniformValues.subarray(kViewDirectionProjectionInverseOffset, kViewDirectionProjectionInverseOffset + 16)

    return { buffer, view, writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, uniformValues) }
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
    const proj = mat4.perspective(60 * (Math.PI / 180), canvasAspect, 0.1, 10)
    const cameraPosition = [Math.cos(time * 0.1), 0, Math.sin(time * 0.1)]
    const view = mat4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0])
    // カメラの位置は関係なく向いている方向の情報のみ必要なため、平行移動をゼロにする
    view[12] = 0
    view[13] = 0
    view[14] = 0

    const viewProj = mat4.multiply(proj, view)
    mat4.inverse(viewProj, this.uniformData.view)

    this.uniformData.writeBuffer()

    // draw
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(3)
  }
}
