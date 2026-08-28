import { GPU } from '@/modules/webgpu/GPU'
import shader from './index.wgsl'

const { device } = await GPU.request()

// =============================
// bind group layout
// =============================

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', hasDynamicOffset: true } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', hasDynamicOffset: true } },
    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', hasDynamicOffset: true } },
  ],
})

// =============================
// pipeline layout
// =============================

const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [bindGroupLayout],
})

// =============================
// pipeline
// =============================

const module = device.createShaderModule({ code: shader })

const pipeline = device.createComputePipeline({
  layout: pipelineLayout,
  compute: { module },
})

// =============================
// storage buffer
// =============================

const input = new Float32Array(64 * 3)
input.set([1, 3, 5])
input.set([11, 12, 13], 64)

const workBuffer = device.createBuffer({
  size: input.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(workBuffer, 0, input)

const resultBuffer = device.createBuffer({
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
})

// =============================
// bind group
// =============================

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: workBuffer, size: 256 } },
    { binding: 1, resource: { buffer: workBuffer, size: 256 } },
    { binding: 2, resource: { buffer: workBuffer, size: 256 } },
  ],
})

// =============================
// compute
// =============================

const encoder = device.createCommandEncoder()
const pass = encoder.beginComputePass()
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup, [0, 256, 512])
pass.dispatchWorkgroups(3)
pass.end()

encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

device.queue.submit([encoder.finish()])

await resultBuffer.mapAsync(GPUMapMode.READ)
const result = new Float32Array(resultBuffer.getMappedRange().slice())
resultBuffer.unmap()

document.querySelector<HTMLElement>('.log .src-a span')!.innerText = input.slice(0, 3).join(', ')
document.querySelector<HTMLElement>('.log .src-b span')!.innerText = input.slice(64, 64 + 3).join(', ')
document.querySelector<HTMLElement>('.log .dst span')!.innerText = result.slice(128, 128 + 3).join(', ')
