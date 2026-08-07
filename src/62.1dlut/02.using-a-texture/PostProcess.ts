import { GPU } from '@/modules/webgpu/GPU'
import type { RenderTarget } from '@/modules/webgpu/RenderTarget'
import shader from './postProcess.wgsl'
import type GUI from 'lil-gui'
import { gradients } from './gradient'
import * as wgu from 'webgpu-utils'

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
      gradient: Float32Array
    }
    writeBuffer: () => void
  }
  private bindGroup?: GPUBindGroup
  private readonly lutBindGroups: GPUBindGroup[]
  private settings = {
    brightness: 0,
    contrast: 0,
    lutAmount: 1,
    lut: 0,
  }

  constructor(private readonly gpu: GPU) {
    this.device = gpu.device
    this.pipeline = this.createPipeline()
    this.sampler = this.createSampler()
    this.renderPassDescriptor = this.createRenderPassDescriptor()
    this.uniformData = this.createUniformData()
    this.lutBindGroups = this.createLutBindGroups()
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
    //   gradient: f32,
    //   [padding]
    // };

    const p = 1
    const bufferSize = (1 + 1 + 1 + p) * 4
    const dataArray = new Float32Array(bufferSize / 4)
    // views
    const brightness = dataArray.subarray(0, 1)
    const contrast = dataArray.subarray(1, 2)
    const gradient = dataArray.subarray(2, 3)

    brightness.set([this.settings.brightness])
    contrast.set([this.settings.contrast])
    gradient.set([this.settings.lutAmount])

    const buffer = this.device.createBuffer({
      size: dataArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, dataArray)

    return {
      buffer,
      views: { brightness, contrast, gradient },
      writeBuffer: () => this.device.queue.writeBuffer(buffer, 0, dataArray),
    }
  }

  private createLutBindGroups() {
    const sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' })

    const ctx = new OffscreenCanvas(256, 1).getContext('2d')!

    return gradients.map((stops) => {
      const grad = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0)
      for (const [r, g, b, stop] of stops) {
        grad.addColorStop(stop, `rgb(${r}, ${g}, ${b})`)
      }
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, ctx.canvas.width, 1)
      const texture = wgu.createTextureFromSource(this.device, ctx.canvas)

      return this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: texture },
          { binding: 1, resource: sampler },
        ],
      })
    })

    // const rgbToUnorm8 = (rgb: [number, number, number]) => [0, 0, 0, 1].map((v: number, i: number) => ((rgb[i] ?? v) * 255) | 0)
    // // prettier-ignore
    // const gradientColors = new Uint8Array([
    //   ...rgbToUnorm8([0.1, 0, 0.5]),
    //   ...rgbToUnorm8([1, 0.69, 0.4]),
    // ])
    // const texture = this.device.createTexture({
    //   size: [2],
    //   format: 'rgba8unorm',
    //   usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    // })
    // this.device.queue.writeTexture({ texture }, gradientColors, {}, [2])

    // return this.device.createBindGroup({
    //   layout: this.pipeline.getBindGroupLayout(1),
    //   entries: [
    //     { binding: 0, resource: texture },
    //     { binding: 1, resource: sampler },
    //   ],
    // })
  }

  setSettings(gui: GUI, render: () => void) {
    gui.add(this.settings, 'brightness', -1, 1, 0.01).onChange((value: number) => {
      this.uniformData.views.brightness.set([value])
    })
    gui.add(this.settings, 'contrast', -1, 10, 0.01).onChange((value: number) => {
      this.uniformData.views.contrast.set([value])
    })
    gui
      .add(this.settings, 'lutAmount', 0, 1, 0.01)
      .name('lut amount')
      .onChange((value: number) => {
        this.uniformData.views.gradient.set([value])
      })

    // gradient buttons
    const lutGradients = document.querySelector<HTMLElement>('.lut-gradients')!

    for (let i = 0; i < gradients.length; i++) {
      const stops = gradients[i]
      const btn = document.createElement('button')
      lutGradients.append(btn)
      btn.style.background = `linear-gradient(to right, ${stops.map(([r, g, b, stop]) => `rgb(${r}, ${g}, ${b}) ${stop * 100}%`).join(',')})`
      btn.addEventListener('click', () => {
        this.settings.lut = i
        render()
      })
    }
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
    pass.setBindGroup(1, this.lutBindGroups[this.settings.lut])
    pass.draw(3)
    pass.end()
  }
}
