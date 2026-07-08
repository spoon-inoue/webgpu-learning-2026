import shader from './index.wgsl'

const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')

const module = device.createShaderModule({
  label: 'doubling compute module',
  code: shader,
})

const pipeline = device.createComputePipeline({
  label: 'doubling compute pipeline',
  layout: 'auto',
  compute: { module },
})

const input = new Float32Array([1, 3, 5])

const workBuffer = device.createBuffer({
  label: 'work buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(workBuffer, 0, input)

const resultBuffer = device.createBuffer({
  label: 'result buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
})

const bindGroup = device.createBindGroup({
  label: 'bindGroup for work buffer',
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: workBuffer }],
})

// render
const encoder = device.createCommandEncoder({ label: 'doubling encoder' })

const pass = encoder.beginComputePass({ label: 'doubling compute pass' })
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup)
pass.dispatchWorkgroups(input.length)
pass.end()

encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

const commandBuffer = encoder.finish()
device.queue.submit([commandBuffer])

// result
await resultBuffer.mapAsync(GPUMapMode.READ)
const result = new Float32Array(resultBuffer.getMappedRange().slice())
resultBuffer.unmap()

const inputValue = document.querySelector<HTMLElement>('.log .input .value')!
const outputValue = document.querySelector<HTMLElement>('.log .output .value')!

inputValue.innerText = `[${input.join(', ')}]`
outputValue.innerText = `[${result.join(', ')}]`
