import { GPU } from '@/modules/webgpu/GPU'
import shader from './main.wgsl'
import * as wgu from 'webgpu-utils'
import { mat4 } from 'wgpu-matrix'

export class Main {
  private readonly device: GPUDevice
  private readonly pipeline: GPURenderPipeline
  private readonly renderPassDescriptor: GPURenderPassDescriptor
  private readonly uniformData: {
    buffer: GPUBuffer
    views: { matrix: Float32Array }
    writeBuffer: () => void
  }
  private readonly sampler: GPUSampler
  private imageTexture?: GPUTexture
  private bindGroup?: GPUBindGroup
  private renderTarget?: GPUTexture

  constructor(gpu: GPU) {
    this.device = gpu.device
    this.pipeline = this.createPipeline()
    this.renderPassDescriptor = this.createRenderPassDescriptor()
    this.uniformData = this.createUniformData()
    this.sampler = this.createSampler()
  }

  async load() {
    const texture = await this.updateImageTexture('david-clode-clown-fish.jpg')
    this.updateBindGroup(texture)
    return this
  }

  private createPipeline() {
    const module = this.device.createShaderModule({ code: shader })
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module },
      fragment: {
        module,
        targets: [{ format: 'rgba8unorm' }],
      },
    })
  }

  private createRenderPassDescriptor(): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: null as any,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    }
  }

  private createUniformData() {
    const data = new Float32Array(16)
    const matrixView = data.subarray(0, 16)
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    return {
      buffer,
      views: { matrix: matrixView },
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, data),
    }
  }

  async updateImageTexture(fileName: string) {
    const path = import.meta.env.BASE_URL + 'assets/images/' + fileName
    const texture = await wgu.createTextureFromImage(this.device, path)
    this.imageTexture = texture
    return texture
  }

  private createSampler() {
    return this.device.createSampler({ minFilter: 'linear', magFilter: 'linear' })
  }

  private updateBindGroup(imageTexture: GPUTexture) {
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.uniformData.buffer },
        { binding: 1, resource: imageTexture },
        { binding: 2, resource: this.sampler },
      ],
    })
  }

  updateRenderTarget(size: { width: number; height: number }) {
    if (this.renderTarget?.width === size.width && this.renderTarget.height === size.height) {
      return
    }

    this.renderTarget?.destroy()
    this.renderTarget = this.device.createTexture({
      size,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })
    const renderTargetView = this.renderTarget.createView()
    this.renderPassDescriptor.colorAttachments[0]!.view = renderTargetView
    return renderTargetView
  }

  render(encoder: GPUCommandEncoder) {
    if (!this.bindGroup || !this.renderTarget || !this.imageTexture) return

    const canvasAspect = this.renderTarget.width / this.renderTarget.height
    const imageAspect = this.imageTexture.width / this.imageTexture.height
    const aspect = canvasAspect / imageAspect
    const aspectScale = aspect > 1 ? [1, aspect, 1] : [1 / aspect, 1, 1]

    const matrix = this.uniformData.views.matrix
    mat4.identity(matrix)
    mat4.scale(matrix, [2, 2, 1], matrix)
    mat4.scale(matrix, aspectScale, matrix)
    mat4.translate(matrix, [-0.5, -0.5, 1], matrix)

    this.uniformData.writeBuffer()

    const pass = encoder.beginRenderPass(this.renderPassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(6)
    pass.end()
  }
}
