import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import GUI from 'lil-gui'
import { mat4 } from 'wgpu-matrix'
import shaderCode from './index.wgsl'
import { copySourceToTexture, createTextureFromSource } from './mipmap'

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
// mipmap
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
video.src = `${import.meta.env.BASE_URL}assets/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm`
await waitForClick()
await startPlayingAndWaitForVideo(video)

let haveNewVideoFrame = false
function recordHaveNewFrame() {
  haveNewVideoFrame = true
  video.requestVideoFrameCallback(recordHaveNewFrame)
}
video.requestVideoFrameCallback(recordHaveNewFrame)

const texture = createTextureFromSource(device, video, { mips: true })

const textures = await Promise.all([texture])

const kMatrixOffset = 0

const ObjectInfos = Array.from({ length: 8 }, (_, i) => {
  const sampler = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: i & 1 ? 'linear' : 'nearest',
    minFilter: i & 2 ? 'linear' : 'nearest',
    mipmapFilter: i & 4 ? 'linear' : 'nearest',
  })

  const uniformBufferSize = 16 * 4
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const uniformValues = new Float32Array(uniformBufferSize / 4)
  const matrix = uniformValues.subarray(kMatrixOffset, 16)

  const bindGroups = textures.map((texture) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture },
        { binding: 2, resource: uniformBuffer },
      ],
    }),
  )

  return { bindGroups, matrix, uniformValues, uniformBuffer }
})

// =============================
// settings
// =============================

let texNdx = 0

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
  if (haveNewVideoFrame) {
    haveNewVideoFrame = false
    copySourceToTexture(device, texture, video)
  }

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

  ObjectInfos.forEach(({ bindGroups, matrix, uniformBuffer, uniformValues }, i) => {
    const bindGroup = bindGroups[texNdx]

    const xSpacing = 1.2
    const ySpacing = 0.7
    const zDepth = 50

    const x = (i % 4) - 1.5
    const y = i < 4 ? 1 : -1

    mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix)
    mat4.rotateX(matrix, 0.5 * Math.PI, matrix)
    mat4.scale(matrix, [1, zDepth * 2, 1], matrix)
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
