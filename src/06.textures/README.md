# テクスチャ

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-textures.html

テクスチャとは

- 多くの場合、2D画像を表す
- 色の値の2D配列
- サンプラーを使用できる
  - テクスチャ内の最大16個の値を読み取り、値をブレンドする
  - 例えば、解像度の低い画像について画像サイズを上げると、ピクセル化してしまうが、サンプラーを使うことで平滑化することができる
- WGSLでテクスチャを扱う場合は、以下が必要
  - `Texture`: ポインタ
  - `Sampler`: データの取得方法を表す
  - `TexCoord`: 値を取得する場所。テクスチャ座標
- テクスチャ座標は、実際のサイズに関係なく、テクスチャ座標で`0.0 ~ 1.0`の値をとる

## Fの描画

```wgsl
textureSample(ourTexture, ourSampler, fsIn.texcoord);
```

- `textureSample`を使って、`vec4f`の色データを取得する
- 今回のケースでは、頂点位置を`texcoord`として利用したが、通常は頂点バッファとして渡す

```ts
const texture = device.createTexture({
  size: [kTextureWidth, kTextureHeight],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})
```

- rgba8unorm
  - rgbaの8ビット符号なし整数で、`テクスチャで使用されるとき`に正規化される
  - Texture系のみで利用可能なフォーマット（Uniformでは使用できない）
  - unormは、unsigned normalizedの略で、`0 ~ 255`の整数値を`0 ~ 1`の浮動小数点値に変換する
- usage

  | 値              | 説明                                       |
  | :-------------- | :----------------------------------------- |
  | TEXTURE_BINDING | バインドグループにバインドできるようにする |
  | COPY_DST        | データを書き込めるようにする               |

```ts
// prettier-ignore
device.queue.writeTexture(
  { texture }, 
  textureData, 
  { bytesPerRow: kTextureWidth * 4 }, 
  { width: kTextureWidth, height: kTextureHeight }
)
```

パラメータを上から、

- 更新したいテクスチャ
- コピーしたいデータ
- テクスチャにコピーするときに、そのデータを読み取る方法

  | パラメータ   | 説明                                           | 省略          |
  | :----------- | :--------------------------------------------- | :------------ |
  | offset       | Bufferの先頭から何バイト目に画像データがあるか | 0バイト目から |
  | bytesPerRow  | 1行あたり何バイトのデータを読み取るか          |               |
  | rowsPerImage | 1枚の画像が何行あるか                          | height        |

- コピーするサイズ

### Fを反転させる

なぜ反転しているのか

- テクスチャ座標`(0, 0)`が、テクスチャの最初のテクセル（b）を参照しているため
  ```ts
  // prettier-ignore
  const textureData = new Uint8Array([
    b, _, _, _, _,
    _, y, y, y, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, _, _, _, _,
  ].flat())
  ```

反転させるには

- 頂点シェーダーで、yを反転させる
  ```wgsl
  vsOut.texcoord = vec2(xy.x, 1. - xy.y);
  ```
- テクスチャデータを反転させる
  ```ts
  // prettier-ignore
  const textureData = new Uint8Array([
    _, _, _, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, y, y, _,
    b, _, _, _, _,
  ].flat())
  ```

データの反転は一般的で、テクスチャを生成するときにデータを反転させるオプションがあることが多い（WebGPU APIはない）

## magFilter

テクスチャがそのサイズよりも大きく描画されるとき使用されるフィルター

上記のFの描画では、`nearest`（デフォルト）になっているが、`linear`に変更することで4つのピクセル間での線形補間がされる

```diff
- const sampler = device.createSampler()
+ const sampler = device.createSampler({ magFilter: 'linear' })
```

- テクスチャ座標は`uv`と呼ばれる（uvは軸の名前なので、texcoordが正しい？）
- 特定のuvに対して、最も近い4つのピクセルが選択される
- それぞれのピクセルの中心間距離の線形補間で色を混合する
- テクスチャ境界（uvが`0 ~ 1`を超える場合）の振る舞いを設定するには、`addressModeU`，`addressModeV`を使用する
  | 値            | 説明                             |
  | :------------ | :------------------------------- |
  | clamp-to-edge | テクスチャの端の色を使い続ける   |
  | repeat        | テクスチャを繰り返す             |
  | mirror-repeat | テクスチャを反転しながら繰り返す |

## minFilter

テクスチャがそのサイズよりも小さく描画されるとき使用されるフィルター

magFilterと同様に4つのピクセルの値をブレンドして色を計算する。問題は、この時`ちらつき`が発生する。

理由

- uvは実数だが、ピクセルは整数であるため。[説明図](https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-textures.html#a-pixel-to-texcoords)

<図>

この問題を解決するために、テクスチャは`mipmap`を提供する。

mipmapとは

- 「マルチイメージピラミッドマップ」の略？
- テクスチャの各次元（width, height）を1x1になるまで半分にしたマップ
- mipmapを作成すると、元のテクスチャサイズより小さいサイズの描画を行うときに、GPUが小さなミップレベルを要求できる
