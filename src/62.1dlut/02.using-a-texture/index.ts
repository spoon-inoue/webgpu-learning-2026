import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import { Main } from './Main'
import { PostProcess } from './PostProcess'
import GUI from 'lil-gui'

const gpu = await GPU.request()
const device = gpu.device

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: {
    format: gpu.presentationFormat,
  },
})

// =================================
// scene
// =================================
const main = await new Main(gpu).load()
const postProcess = new PostProcess(gpu)

// =================================
// settings
// =================================

const gui = new GUI()
gui.onChange(render)
postProcess.setSettings(gui, render)

// =================================
// render
// =================================

function render() {
  const view = main.updateRenderTarget(renderTarget.canvas)
  view && postProcess.updateBindGroup(view)

  const encoder = device.createCommandEncoder()

  main.render(encoder)
  postProcess.render(encoder, renderTarget)

  device.queue.submit([encoder.finish()])
}

createResizeObserver(device, render).observe(renderTarget.canvas)
