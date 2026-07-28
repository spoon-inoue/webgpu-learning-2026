import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, clearColor: [0.3, 0.3, 0.3, 1] },
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shaderCode })

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module },
  fragment: { module, targets: [{ format: presentationFormat }] },
})

// =============================
// texture
// =============================

function startPlayingAndWaitForVideo(video: HTMLVideoElement) {
  return new Promise((resolve, reject) => {
    video.addEventListener('error', reject)
    video.requestVideoFrameCallback(resolve)
    video.play().catch(reject)
  })
}

function waitForClick() {
  return new Promise((resolve) => {
    const startBtn = document.querySelector<HTMLButtonElement>('.video-start')!
    startBtn.addEventListener(
      'click',
      () => {
        resolve(null)
        startBtn.style.setProperty('display', 'none')
      },
      { once: true },
    )
  })
}

const video = document.createElement('video')
video.muted = true
video.loop = true
video.preload = 'auto'
video.src = import.meta.env.BASE_URL + 'assets/videos/pexels-anna-bondarenko-5534310 (540p).mp4'
await waitForClick()
await startPlayingAndWaitForVideo(video)

const kMatrixOffset = 0

const ObjectInfos = Array.from({ length: 4 }, (_, i) => {
  const sampler = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: i & 1 ? 'linear' : 'nearest',
    minFilter: i & 2 ? 'linear' : 'nearest',
  })

  const uniformBufferSize = 16 * 4
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / 4)
  const matrix = uniformValues.subarray(kMatrixOffset, 16)

  return { sampler, matrix, uniformValues, uniformBuffer }
})

// =============================
// settings
// =============================

const settings = {
  playing: () => {
    if (video.paused) {
      video.play()
      state.name('pause')
    } else {
      video.pause()
      state.name('play')
    }
  },
}

const gui = new GUI()
const state = gui.add(settings, 'playing').name('pause')

// =============================
// render
// =============================

function render() {
  const fov = 60 * (Math.PI / 180)
  const aspect = renderTarget.canvas.clientWidth / renderTarget.canvas.clientHeight
  const zNear = 1
  const zFar = 2000
  const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar)

  const cameraPosition = [0, 0, 2]
  const up = [0, 1, 0]
  const target = [0, 0, 0]
  const viewMatrix = mat4.lookAt(cameraPosition, target, up)
  const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix)

  renderTarget.update()

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)

  // import video source
  const texture = device.importExternalTexture({ source: video })

  ObjectInfos.forEach(({ sampler, matrix, uniformBuffer, uniformValues }, i) => {
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture },
        { binding: 2, resource: uniformBuffer },
      ],
    })

    const xSpacing = 1.2
    const ySpacing = 0.5
    const zDepth = 1

    const x = (i % 2) - 0.5
    const y = i < 2 ? 1 : -1

    mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix)
    mat4.rotateX(matrix, 0.25 * Math.PI * Math.sign(y), matrix)
    mat4.scale(matrix, [1, -1, 1], matrix)
    mat4.translate(matrix, [-0.5, -0.5, 0], matrix)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
    pass.setBindGroup(0, bindGroup)
    pass.draw(6)
  })

  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(renderTarget.canvas)
