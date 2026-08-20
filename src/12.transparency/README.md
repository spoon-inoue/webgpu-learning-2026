# 透明度とブレンディング

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-transparency.html

## キャンバスのalphaMode

- WebGPU，WebGPU Canvas，HTMLそれぞれに透明度，ブレンディングある

WebGPUキャンバスの透明度について

- デフォルトでは不透明でアルファチャンネルは無視される（`opaque`）
- alphaModeを`premultiplied`にすることで、透明度を設定できる
- `premultiplied`は、キャンバスに入力する色が`既にアルファ値で乗算されている`ことを意味する
- 事前乗算は、自分で行う必要がある

---

<img width="1000" alt="Frame 94" src="https://github.com/user-attachments/assets/bf6f51e1-6d9d-4966-9c0a-4ef98ebe5824" />

- alphaModeを`premultiplied`に設定した状態
- 左図：WebGPU Canvasの色(clearValue)をそのまま出力
- 右図：WebGPU Canvasの色(clearValue)のRGBに、alpha値を乗算した出力

alpha値はともに0.01だが、左図は明らかに赤色が強く反映されている。これは不正な色でありブラウザによって異なり信用できるものではない。

例えば、オレンジ（1, 0.5, 0.25）で、alphaが0.33の場合の事前乗算された値は次のようになる。

```
r = 1.00 * 0.33 = 0.33
g = 0.50 * 0.33 = 0.165
b = 0.25 * 0.33 = 0.0825
```

---

`device.queue.copyExternalImageToTexture`には、事前乗算するかどうかのオプションがある。

```ts
// prettier-ignore
device.queue.copyExternalImageToTexture(
  { source, flipY: true, },
  { texture, premultipliedAlpha: true },
  { width: source.width, height: source.height },
)
```

- テクスチャにコピーするときにWebGPUに色を事前乗算するように指示する
- textureSampleを呼び出すときに取得する値はすでに事前乗算されている

---

まとめ

- `alphaMode: 'premultiplied'`を設定すると、キャンバスを透過できる
- 事前乗算は自分で行う
- 画像からTextureを作成する場合、Texture作成時にpremultipliedの設定を有効にすることで、事前乗算されたTextureを得られ、shader内のsamplingでは事前乗算された値を取得できる。
- Fragment Shader内でも事前乗算できる。（自前でrgb * aする）
  - Textureの場合、mipmapを生成する関係上、Fragment Shader内での事前乗算では遅く、Texture作成時に行うのがベター

## 破棄

- `discard`は、Fragment Shaderで現在のフラグメントを破棄しピクセルを描画しないようにするWGSLのステートメント

```wgsl
@fragment
fn fs(fsIn: VsOut) -> @location(0) vec4f {
  let cyan = vec4f(0, 1, 1, 1);
  let grid = vec2u(fsIn.position.xy) / 8;
  let checker = (grid.x + grid.y) % 2 == 1;

  if (checker) { discard; }

  return cyan;
}
```

- discardをすることで、color bufferだけではなく`depth buffer`にも書き込みが行われないため、前と後ろに重なるようにスプライトがある場合、前面の透過部分の背面にあるスプライトが正確に表示される

## ブレンド設定

RenderPipelineを作成するときに、fragmentの各targetに対してブレンディング状態を設定できる。

```ts
const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module,
  },
  fragment: {
    module,
    targets: [
      {
        format: presentationFormat,
        blend: {
          color: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
          },
        },
      },
    ],
  },
})
```

デフォルトの設定は、

```ts
blend: {
  color: {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'zero',
  },
  alpha: {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'zero',
  },
}
```

- colorは、色の`rgb`部分のブレンドルールを表している
- alphaは、色の`a`部分のブレンドルールを表している

| <div style="width: 160px;">operation</div> | 説明                                     |
| :----------------------------------------- | :--------------------------------------- |
| `add`                                      | srcとdstを加算する。                     |
| `subtract`                                 | srcからdstを減算する。                   |
| `reverse-subtract`                         | dstからsrcを減算する。                   |
| `min`                                      | srcとdstの小さい方を成分ごとに採用する。 |
| `max`                                      | srcとdstの大きい方を成分ごとに採用する。 |

| <div style="width: 160px;">factor</div> | 説明 |
| :-- | :-- |
| `zero` | 係数を0にする。その側の値はブレンド結果に影響しない。 |
| `one` | 係数を1にする。その側の値をそのまま使用する。 |
| `src` | 係数としてsource の色`(Sr, Sg, Sb, Sa)`を使用する。 |
| `one-minus-src` | 係数として`1 - source`を使用する。 |
| `src-alpha` | 係数としてsourceのAlpha`Sa`を使用する。RGBすべてに同じ`Sa`が掛かかる。 |
| `one-minus-src-alpha` | 係数として`1 - Sa`を使用する。通常のAlpha Blendでよく使用される。 |
| `dst` | 係数としてdestinationの色`(Dr, Dg, Db, Da)`を使用する。 |
| `one-minus-dst` | 係数として`1 - destination`を使用する。 |
| `dst-alpha` | 係数としてdestinationのAlpha`Da`を使用する。 |
| `one-minus-dst-alpha` | 係数として`1 - Da`を使用する。 |
| `src-alpha-saturated` | RGBに対して`min(Sa, 1 - Da)`を係数として使用する。Alpha成分に対する係数は`1`となる。加算系のブレンドなどで値が飽和しすぎるのを抑える用途がある。 |
| `constant` | `GPUBlendState`とは別に設定する`blend constant`の値を係数として使用する。`renderPassEncoder.setBlendConstant()`で指定する。 |
| `one-minus-constant` | 係数として`1 - blend constant`を使用する。 |

以下のような計算式になる。

```ts
result = operation(src * srcFactor, dst * dstFactor)
```

operationがaddなら

```ts
result = src * srcFactor + dst * dstFactor
```

デフォルトの場合

```ts
// operation: 'add',
// srcFactor: 'one',
// dstFactor: 'zero',
result = src * 1 + dst * 0 = src
```

最も一般的な設定

```ts
// operation: 'add',
// srcFactor: 'one',
// dstFactor: 'one-minus-src-alpha'
result = src * 1 + dst * (1 - src.a)
```

- こ設定は「事前乗算されたアルファ」で最も良く使用される
- `src`のRGB色が既にアルファ値で「事前乗算」されていることを期待している
- つまり、事前乗算される前のsrcとdstに対するsrc.aの線形補間になっている

```ts
// v = a * (1 - t) + b * t
result = src * src.a + dst * (1 - src.a)
```

### サンプル

BindGroupLayout, PipelineLayoutを作成するケース

- Pipelineを複数作成したいため、BindGroupLayout, PipelineLayoutを作成する
- PipelineLayoutを`auto`で作成した場合、複数のPipelineでBindGroupLayout, PipelineLayoutを共有できない

---

| パラメータ | 値   |
| :--------- | :--- |
| operation  | add  |
| src factor | one  |
| dst factor | zero |

```ts
src_result = src * 1 + dst * 0
```

<img width="700" alt="add_one_zero" src="https://github.com/user-attachments/assets/a79fc5a4-cc5d-4032-8977-21318e363405" />

---

| パラメータ | 値                  |
| :--------- | :------------------ |
| operation  | add                 |
| src factor | one                 |
| dst factor | one-minus-src-alpha |

```ts
src_result = src * 1 + dst * (1 - src.a)
```

<img width="700" alt="add_one_one-minus-src-alpha" src="https://github.com/user-attachments/assets/c6f386d3-6fe9-4832-b0e7-6fdc74ae9d59" />

---

| パラメータ | 値                  |
| :--------- | :------------------ |
| operation  | add                 |
| src factor | one-minus-dst-alpha |
| dst factor | one                 |

```ts
src_result = src * (1 - dst.a) + dst * 1
```

<img width="700" alt="add_one-minus-dst_alpha_one" src="https://github.com/user-attachments/assets/e6f0b98f-2244-43bf-856a-8581a4f2ca73" />

