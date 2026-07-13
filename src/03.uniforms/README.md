# WebGPU ユニフォーム

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-uniforms.html

- Uniformは、シェーダーのグローバル変数のようなもの
- シェーダーを実行する前に値を設定でき、各反復（並列）で共通の値を持つ
- 次のシェーダーの実行時に別の値を設定できる

## Uniformの追加

### WGSL

`uniform`キーワードを使って、uniformを設定する

```wgsl
struct OurStruct {
  color: vec4f,
  scale: vec2f,
  offset: vec2f,
}

@group(0) @binding(0) var<uniform> ourStruct: OurStruct;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );

  return vec4f(pos[vertexIndex] * ourStruct.scale + ourStruct.offset, 0, 1);
}

@fragment
fn fs() -> @location(0) vec4f {
  return ourStruct.color;
}
```

### JS

#### Uniformを扱うための`GPU Buffer`を生成する

```ts
const uniformBufferSize =
  4 * 4 + // color: vec4f = 4 * 32bit = 4 * 4byte
  2 * 4 + // scale: vec2f = 2 * 32bit = 2 * 4byte
  2 * 4 // offset: vec2f = 2 * 32bit = 2 * 4byte

const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})
```

#### `CPU Buffer`に接続するためのViewを生成して、データを書き込む

```ts
const uniformValues = new Float32Array(uniformBufferSize / 4)

const kColorOffset = 0
const kScaleOffset = 4
const kOffsetOffset = 6

// set color
uniformValues.set([0, 1, 0, 1], kColorOffset)
// set offset
uniformValues.set([-0.5, -0.25], kOffsetOffset)
```

- TypedArrayにデータの構造を指定する場合は、データの長さ（数）を指定する
- GPUオブジェクトにデータの構造を指定する場合は、厳密なメモリサイズを指定する必要があるので`BufferSize`を指定する
- lengthとsizeの違い

#### Bind Groupを生成する

```ts
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: uniformBuffer }],
})
```

- `binding: n`は、`@binding(n)`と一致させる

### メモリレイアウトについて

こちらは、後のセクションなので、要点のみ説明する

[構造体とメモリレイアウト](https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-memory-layout.html)

- `16byte`区切りのレイアウトになる
- データ型固有の`アラインメント要件`がある
- 空いているデータはpaddingとして埋める必要がある
- 配列や構造体には、基本型とはまた別の、特別なアラインメントのルールがある
- このようなレイアウトルールを覚えて、都度計算するのは大変！
  - [webgpu-utils](https://github.com/greggman/webgpu-utils)を使うとこの問題を回避できる

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

<img width="539" height="292" alt="スクリーンショット 2026-07-13 174429" src="https://github.com/user-attachments/assets/9f7464ca-af29-414b-9e4f-5f5f6bfe3aa6" />

| Type          | Size | Align |
| ------------- | ---: | ----: |
| `i32`         |    4 |     4 |
| `u32`         |    4 |     4 |
| `f32`         |    4 |     4 |
| `f16`         |    2 |     2 |
| `atomic<u32>` |    4 |     4 |
| `atomic<i32>` |    4 |     4 |
| `vec2<i32>`   |    8 |     8 |
| `vec2<u32>`   |    8 |     8 |
| `vec2<f32>`   |    8 |     8 |
| `vec2<f16>`   |    4 |     4 |
| `vec3<i32>`   |   12 |    16 |
| `vec3<u32>`   |   12 |    16 |
| `vec3<f32>`   |   12 |    16 |
| `vec3<f16>`   |    6 |     8 |
| `vec4<i32>`   |   16 |    16 |
| `vec4<u32>`   |   16 |    16 |
| `vec4<f32>`   |   16 |    16 |
| `vec4<f16>`   |    8 |     8 |
| `mat2x2<f32>` |   16 |     8 |
| `mat2x2<f16>` |    8 |     4 |
| `mat3x2<f32>` |   24 |     8 |
| `mat3x2<f16>` |   12 |     4 |
| `mat4x2<f32>` |   32 |     8 |
| `mat4x2<f16>` |   16 |     4 |
| `mat2x3<f32>` |   32 |    16 |
| `mat2x3<f16>` |   16 |     8 |
| `mat3x3<f32>` |   48 |    16 |
| `mat3x3<f16>` |   24 |     8 |
| `mat4x3<f32>` |   64 |    16 |
| `mat4x3<f16>` |   32 |     8 |
| `mat2x4<f32>` |   32 |    16 |
| `mat2x4<f16>` |   16 |     8 |
| `mat3x4<f32>` |   48 |    16 |
| `mat3x4<f16>` |   24 |     8 |
| `mat4x4<f32>` |   64 |    16 |
| `mat4x4<f16>` |   32 |     8 |

## 複数の三角形を描画する

複数の`Uniform Buffer`, `Bind Group`を用意して、drawコマンドごとに切り替える

```ts
function render(device: GPUDevice) {
  renderPassDescriptor.colorAttachments[0]!.view = context.getCurrentTexture().createView()

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)

  const aspect = canvas.width / canvas.height

  for (const { scale, bindGroup, uniformBuffer, uniformValues } of objectInfos) {
    uniformValues.set([scale / aspect, scale], kScaleOffset)
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
  }

  pass.end()

  device.queue.submit([encoder.finish()])
}
```

### ダメなパターン

1. Uniform Bufferに書き込んで、drawコマンドを設定する

```ts
for (let x = -1; x < 1; x += 0.1) {
  uniformValues.set([x, x], kOffsetOffset)
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
  pass.draw(3)
}
pass.end()
```

- 描画コマンドが実行されるのは`submit`のタイミングなので、`uniformBuffer`の値はすべてのオブジェクトについて、最後に書き込んだ値になってしまう

2. コマンドバッファをdrawコマンドだけ生成する

```ts
for (let x = -1; x < 1; x += 0.1) {
  uniformValues.set([x, 0], kOffsetOffset)
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()

  device.queue.submit([encoder.finish()])
}
```

- 都度、コマンドバッファを作成するのは負荷が高い
- ベストプラクティスは、単一のコマンドバッファに対して複数のdrawコールを設定する

## Uniformを用途でわける

三角形を複数描画する例だと、render関数が呼ばれるたびに、ScaleをUniform Valuesに書き込み、Uniform Values全体をUniform Bufferにwriteしている。  
そのため、本来更新が必要ないcolorやoffsetのデータまで上書きをしているため、効率が悪い。

Uniformを用途ごとに分けることで、更新の効率を向上させる。

### WGSL

```wgsl
struct OurStruct {
  color: vec4f,
  offset: vec2f,
}

struct OtherStruct {
  scale: vec2f,
}

@group(0) @binding(0) var<uniform> ourStruct: OurStruct;
@group(0) @binding(1) var<uniform> otherStruct: OtherStruct;
```

用途として、以下のように決める

- `ourStruct`は、初期化時に設定した値から変更しない
- `otherStruct`は、render関数が呼ばれるたびに値が更新される

### JS

```ts
const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  // static uniform
  // ・・・

  // changing uniform
  const uniformValues = new Float32Array(uniformBufferSize / 4)

  const uniformBuffer = device.createBuffer({
    label: `changing uniforms for obj: ${i}`,
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const bindGroup = device.createBindGroup({
    label: `bind group for obj: ${i}`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: staticUniformBuffer },
      { binding: 1, resource: uniformBuffer },
    ],
  })

  return {
    scale: rand(0.2, 0.5),
    uniformBuffer,
    uniformValues,
    bindGroup,
  }
})
```

render関数内

```ts
for (const { scale, bindGroup, uniformBuffer, uniformValues } of objectInfos) {
  // set scale
  uniformValues.set([scale / aspect, scale], kScaleOffset)
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
}
```

- uniformValues, uniformBufferを変更される用途のUniform（この場合、scaleのみを扱う）として、render関数内で更新する
