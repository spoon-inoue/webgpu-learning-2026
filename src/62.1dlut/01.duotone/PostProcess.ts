import { GPU } from '@/modules/webgpu/GPU'
import type { RenderTarget } from '@/modules/webgpu/RenderTarget'
import shader from './postProcess.wgsl'
import type GUI from 'lil-gui'

export class PostProcess {
  private readonly device: GPUDevice
  private readonly pipeline: GPURenderPipeline
  private readonly sampler: GPUSampler
  private readonly renderPassDescriptor: GPURenderPassDescriptor
  private readonly uniformData: {
    buffer: GPUBuffer
    views: {
      brightness: Float32Array
      contrast: Float32Array
      duotone: Float32Array
      duotoneColor1: Float32Array
      duotoneColor2: Float32Array
    }
    writeBuffer: () => void
  }
  private bindGroup?: GPUBindGroup
  private settings = {
    brightness: 0,
    contrast: 0,
    duotone: 1,
    duotoneColor1: [0.1, 0, 0.5],
    duotoneColor2: [1, 0.69, 0.4],
  }

  constructor(private readonly gpu: GPU) {
    this.device = gpu.device
    this.pipeline = this.createPipeline()
    this.sampler = this.createSampler()
    this.renderPassDescriptor = this.createRenderPassDescriptor()
    this.uniformData = this.createUniformData()
  }

  private createPipeline() {
    const module = this.device.createShaderModule({ code: shader })
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module },
      fragment: {
        module,
        targets: [{ format: this.gpu.presentationFormat }],
      },
    })
  }

  private createSampler() {
    return this.device.createSampler({ minFilter: 'linear', magFilter: 'linear' })
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
    // struct Uniforms {
    //   brightness: f32,
    //   contrast: f32,
    //   [padding]
    //   [padding]
    //   @align(16) duotone: f32,
    //   [padding]
    //   [padding]
    //   [padding]
    //   @align(16) duotoneColor1: vec3f,
    //   [padding]
    //   @align(16) duotoneColor2: vec3f,
    //   [padding]
    // };
    const p = 1
    const bufferSize = (1 + 1 + p + p + 1 + p + p + p + 3 + p + 3 + p) * 4
    const dataArray = new Float32Array(bufferSize / 4)
    // views
    const brightness = dataArray.subarray(0, 1)
    const contrast = dataArray.subarray(1, 2)
    const duotone = dataArray.subarray(4, 5)
    const duotoneColor1 = dataArray.subarray(8, 11)
    const duotoneColor2 = dataArray.subarray(12, 16)

    brightness.set([this.settings.brightness])
    contrast.set([this.settings.contrast])
    duotone.set([this.settings.duotone])
    duotoneColor1.set(this.settings.duotoneColor1)
    duotoneColor2.set(this.settings.duotoneColor2)

    const buffer = this.device.createBuffer({
      size: dataArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, dataArray)

    return {
      buffer,
      views: { brightness, contrast, duotone, duotoneColor1, duotoneColor2 },
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, dataArray),
    }
  }

  setSettings(gui: GUI) {
    gui.add(this.settings, 'brightness', -1, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.brightness.set([value])
    })
    gui.add(this.settings, 'contrast', -1, 10, 0.01).onChange((value: number) => {
      this.uniformData.views.contrast.set([value])
    })
    gui.add(this.settings, 'duotone', 0, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.duotone.set([value])
    })
    gui.addColor(this.settings, 'duotoneColor1').onChange((value: [number, number, number]) => {
      this.uniformData.views.duotoneColor1.set(value)
    })
    gui.addColor(this.settings, 'duotoneColor2').onChange((value: [number, number, number]) => {
      this.uniformData.views.duotoneColor2.set(value)
    })

    this.uniformData
  }

  updateBindGroup(renderTargetView: GPUTextureView) {
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: renderTargetView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.uniformData.buffer },
      ],
    })
  }

  render(encoder: GPUCommandEncoder, renderTarget: RenderTarget) {
    if (!this.bindGroup) return

    this.uniformData.writeBuffer()

    this.renderPassDescriptor.colorAttachments[0]!.view = renderTarget.context.getCurrentTexture()
    const pass = encoder.beginRenderPass(this.renderPassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(3)
    pass.end()
  }
}
