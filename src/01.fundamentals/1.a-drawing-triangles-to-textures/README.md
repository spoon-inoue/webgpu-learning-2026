# 三角形の描画

- HTMLの`<canvas>`要素は、Webページ中にテクスチャを提供する
- WebGPUは、canvasにテクスチャを要求して、レンダリングする

WebGPUでテクスチャに描画を行うためには、2つのシェーダーが必要

- Vertex Shader
  - 頂点の位置を計算するためのシェーダー
- Fragment Shader
  - 頂点で決められた領域内のピクセルの色を計算するシェーダー
  - MRT（Multiple Render Target）として、色以外のデータ（位置データ, 法線データ等）を格納する場合もある

## adapter, device

```ts
const adapter = await navigator.gpu?.requestAdapter()
const device = await adapter?.requestDevice()
if (!device) throw Error('need a browser that supports WebGPU')
```

## GPUCanvasContext

```ts
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const context = canvas.getContext('webgpu')!
const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
context.configure({
  device,
  format: presentationFormat,
})
```

- このコンテキストから、Texture Viewを取得してレンダリングをすることで、画面上に描画する
- presentationFormat
  - 推奨のCanvasフォーマット: `rgba8unorm`, `bgra8unorm`
  - そのシステムにおいて彩色な処理方法となる
- context.configure
  - deviceを渡すことで、コンテキストとの関連付けを行う
  - deviceに紐づけるのではなくcanvas contextに紐づけるため、`1対多数`の関係も作れる

## GPUShaderModule

```ts
const module = device.createShaderModule({
  label: 'our hardcoded red triangle shaders',
  code: shader,
})
```

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex: u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );

  return vec4f(pos[vertexIndex], 0, 1);
}

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(1, 0, 0, 1);
}
```

- シェーダーモジュールは、1つ以上のシェーダーを持つコンテナ。上記の例では、Vertex Shader（`@vertex`）とFragment Shader（`@fragment`）の2つのシェーダーを持たせている
  - 同一ファイル内で`@vertex`や`@fragment`を付けたシェーダ関数を他にも定義できる
- `@vertex`, `@fragment`は、それぞれ頂点シェーダ, フラグメントシェーダであることを宣言している
- シェーダーは、WGSL（WebGPU Shading Language）という言語で記述される
  - 解説: [WebGPU WGSL](https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-wgsl.html)
  - 仕様: [WebGPU Shading Language](https://gpuweb.github.io/gpuweb/wgsl/)

```wgsl
@builtin(vertex_index) vertexIndex: u32
```

- ビルトインの`vertex_index`を`vertexIndex`（符号なし32bit整数）として使用する
- 繰り返しのループカウンタ（iteration number）のようなもの
- WebGLでいう`gl_VertexID`

```wgsl
-> @builtin(position) vec4f
```

- 返り値として、ビルトインの`position`を指定する
- 描画モードが`triangle-list`の場合、頂点シェーダが3回呼ばれて、3つのpositionが得られるたびに三角形が描画される
- WebGPUでは、positionは`clip spaca（クリップ空間）`座標として扱われる
  - X：左端が-1.0, 右端が1.0
  - Y：下端が-1.0, 上端が1.0

```wgsl
@fragment fn fs() -> @location(0) vec4f
```

- 引数なしで、vec4fの値を返す
- @location(0)は、「1つ目のレンダーターゲット」であることを意味する

```wgsl
return vec4f(1, 0, 0, 1);
```

- 返り値は、`rgba`に対応していて、`0~1`の範囲で指定する
- 上記の場合、`赤`になる

## ラベルについて

```ts
label: 'our hardcoded red triangle shaders',
```

- WebGPUで生成するオブジェクトは、ほぼすべて`label`を付けることができる
- `label`付けは必須ではないが、エラーが発生した際にその場所を特定するのに役立つ

## GPURenderPipeline

```ts
const pipeline = device.createRenderPipeline({
  label: 'our hardcoded red triangle pipeline',
  layout: 'auto',
  vertex: {
    module,
    entryPoint: 'vs',
  },
  fragment: {
    module,
    entryPoint: 'fs',
    targets: [{ format: presentationFormat }],
  },
})
```

- layout
  - `pipeline layout`を設定する
    - pipeline layout: どのシェーダでどのデータを使うか、データをどのように扱うかを指定する
  - `auto`にした場合、シェーダのコードから自動で設定される
- entryPoint
  - そのシェーダのentry関数を指定する
  - シェーダ内に@vertex, @fragmentがそれぞれ1つしか存在しない場合は省略できる
- targets
  - レンダーターゲットのフォーマットを指定する。ここでは、推奨のCanvasフォーマットを指定している
  - 配列は、fragment shaderの`@location(0)`に対応している

## GPURenderPassDescriptor

```ts
const renderPassDescriptor: GPURenderPassDescriptor = {
  label: 'our basic canvas renderPass',
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}
```

- colorAttachments
  - 描画対象となるテクスチャとその扱いを設定する
- view
  - 描画対象となるテクスチャを設定する
  - リサイズなどでテクスチャサイズが変わる場合は、その都度設定する必要があるため、render関数内で再設定している
- clearValue
  - 背景を塗りつぶす色を指定する
- loadOp
  - `clear`: 描画開始前にテクスチャ全体を背景色で塗りつぶす
  - `load`: その時点のテクスチャの内容に上書きして描画する
- storeOp
  - `store`: 描画内容をテクスチャに保存する
  - `discard`: 描画内容を破棄する

## render

```ts
function render(device: GPUDevice) {
  renderPassDescriptor.colorAttachments[0]!.view = context.getCurrentTexture().createView()

  const encoder = device.createCommandEncoder({ label: 'our encoder' })
  const pass = encoder.beginRenderPass(renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()

  const commandBuffer = encoder.finish()
  device.queue.submit([commandBuffer])
}

render(device)
```

- GPUTextureView
  - canvas contextのtexture viewを描画対象に設定する
- GPUCommandEncoder
  - コマンドエンコーダーは、コマンドバッファを生成するために使われ、このバッファにコマンドを並べていく
  - 最終的に`submit`でコマンドバッファを送信することで、コマンドが実行される
- GPURenderPassEncoder
  - レンダリングに関するコマンドを生成する役割をもつ
  - コマンドエンコーダーから`beginRenderPass`を使用して、レンダーパスエンコーダーを生成する
  - 生成時に、`GPURenderPassDescriptor`を渡すことで、描画対象を指定する
- コマンド
  - setPipeline
    - GPURenderPipelineを設定する
  - draw
    - 頂点シェーダを実行する。ここでは引数に渡された3回実行している
    - 頂点シェーダが3回実行されるたびに、3つの点を結ぶ三角形が描画される
  - end
    - GPURenderPassEncoderを終了する
- submit
  - GPUCommandEncoderを`finish`することで、コマンドバッファを取得する
  - コマンドバッファを`submit`して、レンダリングを実行する

`setPipeline`や`draw`等のコマンドは、コマンドバッファに命令を並べているだけで、実行はsubmitしたときに行われる。

## fragment shaderのlocation

以下を一致させる必要がある。

```ts
GPURenderPipeline.fragment.targets[0]
```

```ts
GPURenderPassDescriptor.colorAttachments[0]
```

```wgsl
@fragment fn fs() -> @location(0) vec4f
```
