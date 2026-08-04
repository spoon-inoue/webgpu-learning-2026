import shader from './mipmap.wgsl'

type Options = { mips?: boolean; flipY?: boolean }
type Source = ImageBitmap | HTMLCanvasElement | HTMLVideoElement

function getSourceSize(source: Source): [number, number] {
  if (source instanceof HTMLVideoElement) {
    return [source.videoWidth, source.videoHeight]
  } else {
    return [source.width, source.height]
  }
}

function numMipLevels(...sizes: number[]) {
  const maxSize = Math.max(...sizes)
  return 1 + (Math.log2(maxSize) | 0)
}

// async function loadImageBitmap(url: string) {
//   const res = await fetch(url)
//   const blob = await res.blob()
//   return await createImageBitmap(blob, { colorSpaceConversion: 'none' })
// }

export function copySourceToTexture(device: GPUDevice, texture: GPUTexture, sources: Source[], options?: Options) {
  sources.forEach((source, layer) => {
    device.queue.copyExternalImageToTexture(
      { source, flipY: options?.flipY },
      { texture, origin: [0, 0, layer] },
      { width: source.width, height: source.height },
    )
  })
  if (texture.mipLevelCount > 1) {
    generateMips(device, texture)
  }
}

export function createTextureFromSource(device: GPUDevice, sources: Source[], options?: Options) {
  const source = sources[0]
  const size = getSourceSize(source)
  const texture = device.createTexture({
    format: 'rgba8unorm',
    mipLevelCount: options?.mips ? numMipLevels(...size) : 1,
    size: [size[0], size[1], sources.length],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  copySourceToTexture(device, texture, sources, options)
  return texture
}

const generateMips = (() => {
  let sampler: GPUSampler | null = null
  let module: GPUShaderModule | null = null
  const pipelineByFormat: { [key in GPUTextureFormat]?: GPURenderPipeline } = {}

  return function generateMips(device: GPUDevice, texture: GPUTexture) {
    if (!module) {
      module = device.createShaderModule({ code: shader })
    }
    if (!sampler) {
      sampler = device.createSampler({ minFilter: 'linear' })
    }

    if (!pipelineByFormat[texture.format]) {
      pipelineByFormat[texture.format] = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module },
        fragment: { module, targets: [{ format: texture.format }] },
      })
    }
    const pipeline = pipelineByFormat[texture.format]!

    const encoder = device.createCommandEncoder({ label: 'mip gen encoder' })

    for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; baseMipLevel++) {
      for (let layer = 0; layer < texture.depthOrArrayLayers; layer++) {
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
                baseMipLevel,
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
        pass.draw(6)
        pass.end()
      }
    }

    device.queue.submit([encoder.finish()])
  }
})()

// export async function createTextureFromImage(device: GPUDevice, url: string, options?: Options) {
//   const imgBitmap = await loadImageBitmap(url)
//   return createTextureFromSource(device, imgBitmap, options)
// }
