# GPU上で計算を実行する

- `Compute Shader`を使用する
- レンダリングが不要なため、Canvasコンテキスト（Canvas Element）が不要
  - Three.jsで同等のことを行うためには、Canvasへのレンダリング（Fragment Shader）を利用して行うため、Canvasコンテキストが必要

## Compute Shader

```ts
const module = device.createShaderModule({
  label: 'doubling compute module',
  code: shader,
})
```

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(1)
fn cs(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  data[i] = data[i] * 2.;
}
```

### 詳細

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

- storageタイプ
- 読み書き可能
- 32ビット浮動小数点数の配列
- バインドロケーションの0番目、バインドグループの0番目に設定している

```wgsl
@compute @workgroup_size(1)
fn cs(@builtin(global_invocation_id) id: vec3u)
```

- ワークグループサイズを1に設定している（※後述）
- `global_invocation_id`
  - invocation = `呼び出し`
  - 32ビット整数値の3要素からなるベクトル
  - 頂点シェーダの`vertex_index`と同様の繰り返し番号
  - 違いは、このidは3要素からなるベクトルであるということ

疑似コード

```ts
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = { x, y, z }
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  // from @workgroup_size in WGSL
  const workgroup_size = shaderCode.workgroup_size
  const { x: width, y: height, z: depth } = workgroup_size
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const local_invocation_id = { x, y, z }
        const global_invocation_id = workgroup_id * workgroup_size + local_invocation_id
        computeShader(global_invocation_id)
      }
    }
  }
}
```

例えば、

```ts
dispatchWorkgroups(5, 1, 1)
workgroup_size = { x: 3, y: 1, z: 1 }

global_invocation_id = workgroup_id * workgroup_size + local_invocation_id

global_invocation_id = [0, 0, 0] * [3, 0, 0] + [0, 0, 0] = [0, 0, 0]
global_invocation_id = [0, 0, 0] * [3, 0, 0] + [1, 0, 0] = [1, 0, 0]
global_invocation_id = [0, 0, 0] * [3, 0, 0] + [2, 0, 0] = [2, 0, 0]

global_invocation_id = [1, 0, 0] * [3, 0, 0] + [0, 0, 0] = [3, 0, 0]
global_invocation_id = [1, 0, 0] * [3, 0, 0] + [1, 0, 0] = [4, 0, 0]
global_invocation_id = [1, 0, 0] * [3, 0, 0] + [2, 0, 0] = [5, 0, 0]

...
```

### 制限値

[WebGPU Report](https://webgpureport.org/)

| 項目                              | size      |
| :-------------------------------- | :-------- |
| maxComputeInvocationsPerWorkgroup | 256, 1024 |
| maxComputeWorkgroupSizeX          | 256, 1024 |
| maxComputeWorkgroupSizeY          | 256, 1024 |
| maxComputeWorkgroupSizeZ          | 64        |

`maxComputeInvocationsPerWorkgroup`は`workgroup_size`の積で、例えば最低の`256kB`とした場合、以下のように考えられる。

```ts
workgroup_size = [16, 16, 1]
maxComputeInvocationsPerWorkgroup = 16 * 16 * 1 = 256

dispatchWorkgroups(Math.ceil(input.length / 256))
```

## pipeline｜GPUComputePipeline

```ts
const pipeline = device.createComputePipeline({
  label: 'doubling compute pipeline',
  layout: 'auto',
  compute: { module },
})
```

- Compute Shaderを使う場合は、`createComputePipeline`を使用する
- layout
  - `auto`にすることで、データのレイアウトをシェーダコードから自動で設定する
- compute
  - `module`に、GPUShaderModuleを設定する
  - `entryPoint`に、シェーダ内のメイン関数を指定する（自明であれば省略可）

## workBuffer｜GPUBuffer

```ts
const input = new Float32Array([1, 3, 5])

const workBuffer = device.createBuffer({
  label: 'work buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(workBuffer, 0, input)
```

- GPUBuffer
  - GPU上でデータを扱うためバッファ
  - 今回の場合、以下に対応している
    ```wgsl
    var<storage, read_write> data: array<f32>
    ```
  - usage
    - `STORAGE`: torageとして扱うための設定
    - `COPY_SRC`: バッファをデータのコピー元とする
    - `COPY_DST`: バッファをデータのコピー先とする。`writeBuffer`する場合は必要
- writeBuffer
  - GPUBufferにデータを書き込む
    - StorageBufferに初期値を書き込む
    - UniformBufferに値を書き込む

## resultBuffer｜GPUBuffer

```ts
const resultBuffer = device.createBuffer({
  label: 'result buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
})
```

- GPUBufferから、直接CPU（js）上で値を読みだすことができない
  - バッファが配置されているメモリ領域がGPU側であるため
- GPUBufferはCPU上にマップすることはできるが、その間GPU上で使用はできない
  - `StorageBufferはマップできない`

そのため、StorageBufferの値を参照するには、JS側へマップ可能なバッファ（resultBuffer）を作成して、それに値をコピーして、resultBufferを参照する必要がある

- usage
  - `MAP_READ`: データをCPU上にマップできるようにする設定

## bindGroup｜GPUBindGroup

```ts
const bindGroup = device.createBindGroup({
  label: 'bindGroup for work buffer',
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: workBuffer }],
})
```

- GPUBufferの情報をシェーダにつたるためのオブジェクト
- layout
  - GPUComputePipelineから、GPUBindGroupLayoutを取得して設定する
  - `0`は、シェーダの`@group(0)`に対応している
- entries
  - `binding`: シェーダの`@binding(0)`に対応している
  - `resource`: 以下を設定する
    - GPUSampler
    - GPUTexture
    - GPUTextureView,
    - GPUBuffer
    - GPUBufferBinding
    - GPUExternalTexture.

## 実行

```ts
const encoder = device.createCommandEncoder({ label: 'doubling encoder' })

const pass = encoder.beginComputePass({ label: 'doubling compute pass' })
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup)
pass.dispatchWorkgroups(input.length)
pass.end()

encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

const commandBuffer = encoder.finish()
device.queue.submit([commandBuffer])
```

- 三角形の描画（Render）とほぼ同じ
- `beginComputePass`を使用する
- dispatchWorkgroups
  - `実行命令`を設定する（renderのdrawの代わり）
  - 引数には`実行回数`を指定する。今回の場合は、input.length（3）回
- copyBufferToBuffer
  - storageBufferからマップ可能なresultBufferへデータをコピーする

## 計算結果の取得

```ts
await resultBuffer.mapAsync(GPUMapMode.READ)
const result = new Float32Array(resultBuffer.getMappedRange().slice())
resultBuffer.unmap()
```

- `mapAsync`でバッファをCPU上にマップする
- `getMappedRange`でバッファを取得し、Float32ArrayのViewとして値を取得する
  - unmapするとバッファの参照がなくなるので、sliceでコピーする
- `unmap`でマップを終了する。以降はGPU上でBufferを扱える

mapAsyncは少なからず時間がかかるため、ループ処理内で連続してシェーダによる計算とその結果の参照を行う場合、resultBufferを複数用意して待機時間を隠蔽する方法がある（ダブルバッファリング, トリプルバッファリング）
