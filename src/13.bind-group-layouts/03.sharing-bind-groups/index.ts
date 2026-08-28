import { GPU } from '@/modules/webgpu/GPU'
import shaderTimes2 from './times2.wgsl'
import shaderPlus3 from './plus3.wgsl'

const { device } = await GPU.request()

// =============================
// bind group layout
// =============================

const bindGroupLayout = device.createBindGroupLayout({
  entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', hasDynamicOffset: false, minBindingSize: 0 } }],
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

const moduleTimes2 = device.createShaderModule({ code: shaderTimes2 })

const pipelineTimes2 = device.createComputePipeline({
  layout: pipelineLayout,
  compute: { module: moduleTimes2 },
})

const modulePlus3 = device.createShaderModule({ code: shaderPlus3 })

const pipelinePlus3 = device.createComputePipeline({
  layout: pipelineLayout,
  compute: { module: modulePlus3 },
})

// =============================
// storage buffer
// =============================

const input = new Float32Array([1, 3, 5])

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
  layout: bindGroupLayout,
  entries: [{ binding: 0, resource: { buffer: workBuffer } }],
})

// =============================
// compute
// =============================

const encoder = device.createCommandEncoder()
const pass = encoder.beginComputePass()
pass.setBindGroup(0, bindGroup)

pass.setPipeline(pipelineTimes2)
pass.dispatchWorkgroups(input.length)

pass.setPipeline(pipelinePlus3)
pass.dispatchWorkgroups(input.length)

pass.end()

encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

device.queue.submit([encoder.finish()])

await resultBuffer.mapAsync(GPUMapMode.READ)
const result = new Float32Array(resultBuffer.getMappedRange().slice())
resultBuffer.unmap()

document.querySelector<HTMLElement>('.log .input span')!.innerText = input.join(', ')
document.querySelector<HTMLElement>('.log .result span')!.innerText = result.join(', ')
