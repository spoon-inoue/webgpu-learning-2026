import { GPU } from '@/modules/webgpu/GPU'
import { RenderTarget } from '@/modules/webgpu/RenderTarget'
import { createResizeObserver } from '@/modules/webgpu/resize'
import shader from './index.wgsl'
import { createCubeVertices } from './vertices'
import { mat4 } from 'wgpu-matrix'

const { device, presentationFormat } = await GPU.request()

const renderTarget = new RenderTarget({
  device,
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  configure: { format: presentationFormat, alphaMode: 'premultiplied' },
  depthStencil: { enable: true, format: 'depth24plus' },
})

// ==========================================
// Pipeline
// ==========================================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createRenderPipeline({
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

// ==========================================
// Texture
// ==========================================

type Options = { mips: boolean; flipY: boolean }

const numMipLevels = (...sizes: number[]) => {
  const maxSize = Math.max(...sizes)
  return (1 + Math.log2(maxSize)) | 0
}

function copySourcesToTexture(texture: GPUTexture, sources: ImageBitmap[], { flipY }: Options) {
  sources.forEach((source, layer) => {
    device.queue.copyExternalImageToTexture({ source, flipY }, { texture, origin: [0, 0, layer] }, { width: source.width, height: source.height })
  })
  if (texture.mipLevelCount > 1) {
    generateMips(device, texture)
  }
}

function createTextureFromSources(sources: ImageBitmap[], options: Options) {
  // Assume are sources all the same size so just use the first one for width and height
  const source = sources[0]
  const texture = device.createTexture({
    format: 'rgba8unorm',
    mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
    size: [source.width, source.height, sources.length],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  copySourcesToTexture(texture, sources, options)
  return texture
}

const generateMips = (() => {
  let sampler: GPUSampler | null = null
  let module: GPUShaderModule | null = null
  const pipelineByFormat: { [key in GPUTextureFormat]?: GPURenderPipeline } = {}

  return function generateMips(device: GPUDevice, texture: GPUTexture) {
    if (!module) {
      module = device.createShaderModule({
        label: 'textured quad shaders for mip level generation',
        code: /* wgsl */ `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> VSOutput {
              let pos = array(
                vec2f(0, 0),  // center
                vec2f(1, 0),  // right, center
                vec2f(0, 1),  // center, top
                // 2st triangle
                vec2f(0, 1),  // center, top
                vec2f(1, 0),  // right, center
                vec2f(1, 1),  // right, top
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
      })
    }

    if (!sampler) {
      sampler = device.createSampler({
        minFilter: 'linear',
        magFilter: 'linear',
      })
    }

    if (!pipelineByFormat[texture.format]) {
      pipelineByFormat[texture.format] = device.createRenderPipeline({
        label: 'mip level generator pipeline',
        layout: 'auto',
        vertex: { module },
        fragment: { module, targets: [{ format: texture.format }] },
      })
    }
    const pipeline = pipelineByFormat[texture.format]!

    const encoder = device.createCommandEncoder({ label: 'mip gen encoder' })

    for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
      for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            {
              binding: 1,
              resource: texture.createView({
                dimension: '2d',
                baseMipLevel: baseMipLevel - 1,
                mipLevelCount: 1,
                baseArrayLayer: layer,
                arrayLayerCount: 1,
              }),
            },
          ],
        })

        const renderPassDescriptor: GPURenderPassDescriptor = {
          label: 'our basic canvas renderPass',
          colorAttachments: [
            {
              view: texture.createView({
                dimension: '2d',
                baseMipLevel: baseMipLevel,
                mipLevelCount: 1,
                baseArrayLayer: layer,
                arrayLayerCount: 1,
              }),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        }

        const pass = encoder.beginRenderPass(renderPassDescriptor)
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bindGroup)
        pass.draw(6) // call our vertex shader 6 times
        pass.end()
      }
    }
    device.queue.submit([encoder.finish()])
  }
})()

async function loadImageBitmap(url: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  return await createImageBitmap(blob, { colorSpaceConversion: 'none' })
}

async function createTextureFromImages(urls: string[], options: Options) {
  const images = await Promise.all(urls.map(loadImageBitmap))
  return createTextureFromSources(images, options)
}

const texture = await createTextureFromImages(
  ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((name) => `${import.meta.env.BASE_URL}assets/cubemap/${name}.jpg`),
  { mips: true, flipY: false },
)

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})

// ==========================================
// Uniform
// ==========================================

// struct Uniforms {
//   projection: mat4x4f,
//   view: mat4x4f,
//   world: mat4x4f,
//   cameraPosition: vec3f,
//   (padding: 4bytes)
// }

const uniformBufferSize = (16 + 16 + 16 + 3 + 1) * 4

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})

const uniformValues = new Float32Array(uniformBufferSize / 4)

const kProjectionOffset = 0
const kViewOffset = 16
const kWorldOffset = 32
const kCameraPositionOffset = 48

const projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16)
const viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16)
const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16)
const cameraPositionValue = uniformValues.subarray(kCameraPositionOffset, kCameraPositionOffset + 3)

// ==========================================
// Vertex
// ==========================================

const { vertexData, indexData, numVertices } = createCubeVertices()

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(vertexBuffer, 0, vertexData)

const indexBuffer = device.createBuffer({
  size: indexData.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(indexBuffer, 0, indexData)

// ==========================================
// Bind Group
// ==========================================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: uniformBuffer },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
  ],
})

// ==========================================
// render
// ==========================================

function render(time: number) {
  // update uniforms
  time *= 0.001
  mat4.perspective(60 * (Math.PI / 180), renderTarget.size.aspect, 0.1, 10, projectionValue)

  cameraPositionValue.set([0, 0, 4])
  mat4.lookAt(cameraPositionValue, [0, 0, 0], [0, 1, 0], viewValue)

  mat4.identity(worldValue)
  mat4.rotateX(worldValue, time * -0.1, worldValue)
  mat4.rotateY(worldValue, time * -0.2, worldValue)

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  // draw
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)
  pass.setIndexBuffer(indexBuffer, 'uint16')
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(numVertices)
  pass.end()

  device.queue.submit([encoder.finish()])

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

createResizeObserver(device).observe(renderTarget.canvas)
