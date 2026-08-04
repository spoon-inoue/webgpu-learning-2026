# キューブマップ

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-cube-maps.html

- 6つの面で構成されるテクスチャ
- 2次元テクスチャのtexcoord（vec2f）の代わりに、`法線（vec3f）`を使ってサンプリングする

## 法線を使用したサンプリング

```wgsl
struct Vertex {
  @location(0) position: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

struct Uniforms {
  matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex
fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;
  vsOut.position = uni.matrix * vert.position;
  vsOut.normal = normalize(vert.position.xyz);
  return vsOut;
}

@fragment
fn fs(fsIn: VSOut) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, normalize(fsIn.normal));
}
```

- textureの型は、`texture_cube<f32>`とする
- `normal`を使用してサンプリングする

法線（normal）とは、

- 表面が向く方向を表す`単位ベクトル`である
- 今回の例の場合、Cube（立方体）の頂点座標は中心から対象になっているので、頂点座標をnormalizeしたものを法線として利用できる

＜図＞

- フラットシェーディングか、スムーズシェーディングかは上図のようなnormalの違いである
  - 頂点数は同じ

## キューブテクスチャの生成

複数レイヤーをもつテクスチャを生成する

```ts
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
```

- `size`に3要素目を追加する

---

それぞれのレイヤーに対してテクスチャへの書き込みを行う

```ts
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
```

- `origin`で対象のレイヤーを指定する

---

それぞれのレイヤーに対してmipmapを生成する

```ts
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
```

- `dimension`
  - 明示的に`2d`を指定する
  - デフォルトでは、1つ以上のレイヤーを持つ2Dテクスチャは`2d-array`を取得し、ミップマップを生成する上では望ましくないため
- `baseArrayLayer`
  - 現在のレイヤーを設定する
- `arrayLayerCount`
  - レイヤー数を指定する。mipmap生成の場合、対象となるレイヤー1枚1枚に対する処理なので、`1`と設定する

## 用途

キューブマップは、通常は[環境マップ](https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-environment-maps.html)として使用される。今回のような面の法線を使って直接サンプリングするといった用途には用いられない。
