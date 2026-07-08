# 概要・所感

## WebGPU APIの役割

- 三角形/点/直線を、テクスチャ（Canvas）に描く
- GPU上で、計算を実行する

それ以外は、自分で実装する。  
例えば、Three.js（3DCG全般）でいうCamaraやSceneなどのオブジェクトや構造も自分で設計して実装する。

## WebGPU APIの機能

WebGPUは、GPU上で3種類の関数（Shader）を実行することしかしない。

- Vertex Shader
- Fragment Shader
- Compute Shader
  - WebGLにはない。FloatTextureを使ってレンダリングすることで、疑似的に数値計算を行っている。
  - canvas contextを使用しない

JavaScript（CPU上）での`array.forEach`や`array.map`に似ている。  
違いは、

- GPU上で実行される
- 並列計算ができる
- 使用するデータをGPU上に置き、その場所やデータサイズを明示する必要がある

canvasに描画するWebGPUアプリケーションを単純化した構造

<図>

- Pipline
  - `Vertex Shader`, `Fragment Shader`, `Compute Shader`, `Attributes`を設定する
  - AttributesはPiplineに対してレイアウトを指定して、rendering時にバインドする
- BindGroup
  - `Uniform`, `Storage Buffer`, `Texture`, `Sampler`をバインドする
- RenderPassDescription
  - 描画先の`Texture View`を設定する
  - Compute Shaderでは不要
- Internal State
  - コマンドを管理する

WebGPUでは、一度生成したこれらのリソースの中身を変更できない。GPU上にサイズ, 用途, フォーマットを伝えるため。  
変更する場合は、複数のリソースを用意する。

- Command Buffer
- Encoder
  - コマンドをコマンドバッファへエンコードする

※儀式的な書き方かも

```ts
encoder = device.createCommandEncoder()
// 何かを描画する
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setVertexBuffer(1, …)
  pass.setIndexBuffer(...)
  pass.setBindGroup(0, …)
  pass.setBindGroup(1, …)
  pass.draw(...)
  pass.end()
}
// 何か別なものを描画する
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// 何やら計算する
{
  pass = encoder.beginComputePass(...)
  pass.beginComputePass(...)
  pass.setBindGroup(0, …)
  pass.setPipeline(...)
  pass.dispatchWorkgroups(...)
  pass.end();
}
commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);
```

- 各コマンドが実行されると、`internal state`(内部ステート)が設定されていく
- 実行コマンドは、Canvasへの描画であれば`draw`、Compute Shaderであれば`dispatchWorkgroups`になる

## 三角形の描画

https://github.com/spoon-inoue/webgpu-fundamentals/tree/main/src/pages/01.fundamentals/1.a-drawing-triangles-to-textures

## 計算の実行
