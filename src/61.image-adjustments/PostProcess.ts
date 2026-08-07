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
      hue: Float32Array
      saturation: Float32Array
      lightness: Float32Array
    }
    writeBuffer: () => void
  }
  private bindGroup?: GPUBindGroup

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
    // p
    // p
    //   @align(16) hsl: HSL, <-- f32, f32, f32
    // p
    // };
    const bufferSize = (1 + 1 + 1 + 1 + 1 + 1 + 1 + 1) * 4
    const dataArray = new Float32Array(bufferSize / 4)
    const brightness = dataArray.subarray(0, 1)
    const contrast = dataArray.subarray(1, 2)
    const hue = dataArray.subarray(4, 5)
    const saturation = dataArray.subarray(5, 6)
    const lightness = dataArray.subarray(6, 7)

    const buffer = this.device.createBuffer({
      size: dataArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    return {
      buffer,
      views: { brightness, contrast, hue, saturation, lightness },
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, dataArray),
    }
  }

  setSettings(gui: GUI) {
    const settings = {
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0,
      lightness: 0,
    }
    gui.add(settings, 'brightness', -1, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.brightness.set([value])
    })
    gui.add(settings, 'contrast', -1, 10, 0.01).onChange((value: number) => {
      this.uniformData.views.contrast.set([value])
    })
    gui.add(settings, 'hue', -0.5, 0.5, 0.01).onChange((value: number) => {
      this.uniformData.views.hue.set([value])
    })
    gui.add(settings, 'saturation', -1, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.saturation.set([value])
    })
    gui.add(settings, 'lightness', -1, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.lightness.set([value])
    })
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
