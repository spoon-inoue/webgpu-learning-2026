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

`magFilter`

<img width="800px" alt="Frame 71" src="https://github.com/user-attachments/assets/df2a9f4e-ea17-4c3e-a228-19ff77ead874" />

`minFilter`

<img width="800px" alt="Frame 72" src="https://github.com/user-attachments/assets/7886a45d-34e3-477e-8fc3-db6a406f0aca" />

同一のピクセル内でもuvによって参照されるサンプルポイントが変わる。

この問題を解決するために、テクスチャは`mipmap`を提供する。

## mipmap

- 「マルチイメージピラミッドマップ」の略？
- テクスチャの解像度を、Canvasの解像度以上にする
  - テクスチャの各次元（width, height）を1x1になるまで半分にしたマップ
- mipmapを作成すると、元のテクスチャサイズより小さいサイズの描画を行うときに、GPUが小さなミップレベルを要求できる

mipmapの設定

```ts
const texture = device.createTexture({
  size: [mips[0].width, mips[0].height],
  mipLevelCount: mips.length,
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})

mips.forEach(({ data, width, height }, mipLevel) => {
  // prettier-ignore
  device.queue.writeTexture(
    { texture, mipLevel }, 
    data, 
    { bytesPerRow: width * 4 }, 
    { width, height }
  )
})
```

## mipmapFilter

ミップレベル間でのブレンド方法を指定する

| 値      | 説明                                    |
| :------ | :-------------------------------------- |
| nearest | 最も近いミップマップレベルを1つだけ使用 |
| linear  | 隣接する2つのミップマップレベルを補間   |

```ts
const sampler = device.createSampler({
  mipmapFilter: 'linear',
})
```

サンプル

<img width="800" alt="スクリーンショット 2026-07-22 143235" src="https://github.com/user-attachments/assets/cf43e181-6950-46a1-8513-68ba1f8292d1" />
<img width="800" alt="スクリーンショット 2026-07-22 143249" src="https://github.com/user-attachments/assets/b08269c5-bacd-4965-9a93-8460f657d025" />


| 位置  | magFilter | minFilter | mipmapFilter |
| :---- | :-------- | :-------- | :----------- |
| 上左1 | ◇ nearest | ◇ nearest | ◇ nearest    |
| 上左2 | ◆ linear  | ◇ nearest | ◇ nearest    |
| 上左3 | ◇ nearest | ◆ linear  | ◇ nearest    |
| 上左4 | ◆ linear  | ◆ linear  | ◇ nearest    |
| 下左1 | ◇ nearest | ◇ nearest | ◆ linear     |
| 下左2 | ◆ linear  | ◇ nearest | ◆ linear     |
| 下左3 | ◇ nearest | ◆ linear  | ◆ linear     |
| 下左4 | ◆ linear  | ◆ linear  | ◆ linear     |

なぜ常にすべてのフィルタリングを`linear`にしないのか？

- ピクセル化された画像を作成するような場合は不要だから
- linearの方がnearestよりサンプリング回数が多いから（負荷が高い）

## テクスチャタイプ

- `1d`, `2d`, `3d`がある
- テクスチャの最大許容寸法が異なる
  | タイプ | フィールド            | 制限値      |
  | :----- | :-------------------- | :---------- |
  | 1d     | maxTextureDimension1D | 16384 (16k) |
  | 2d     | maxTextureDimension2D | 16384 (16k) |
  | 3d     | maxTextureDimension3D | 2048 (2k)   |
- フィルターを`linear`にした時のサンプリング数が異なる

## テクスチャービュー

| タイプ | ビュー                                                                   |
| :----- | :----------------------------------------------------------------------- |
| 1d     | 1d                                                                       |
| 2d     | 2d<br />2d-array<br />cube（6レイヤー）<br />cube-array（6倍数レイヤー） |
| 3d     | 3d                                                                       |

- 2d-array
  - 2Dテクスチャの配列
  - 用途は、地形レンダリングなど
- cube
  - キューブの6つの面を表すテクスチャ
  - 用途は、スカイボックスや、反射・環境マップに使用される
- cube-array
  - キューブテクスチャの配列

### WGSLにおける型

| タイプ | WGSLタイプ |
| :-- | :-- |
| 1d | texture_1d<br />texture_storage_1d |
| 2d | texture_2d<br />texture_storage_2d<br />texture_multisampled_2d<br />texture_depth_2d（特定の状況）<br />texture_depth_multisampled_2d（特定の状況） |
| 2d-array | texture_2d_array<br />texture_storage_2d_array<br />texture_depth_2d_array（場合による） |
| 3d | texture_3d<br />texture_storage_3d |
| cube | texture_cube<br />texture_depth_cube（場合による） |
| cube-array | texture_cube_array<br />texture_depth_cube_array（場合による） |

## テクスチャ形式

| Format          | Renderable | Multisample | Storage | Sample Type        | Bytes / Pixel |
| :-------------- | :--------: | :---------: | :-----: | :----------------- | ------------: |
| r8unorm         |     ✓      |      ✓      |         | float              |             1 |
| r8snorm         |            |             |         | float              |             1 |
| r8uint          |     ✓      |      ✓      |         | uint               |             1 |
| r8sint          |     ✓      |      ✓      |         | sint               |             1 |
| r16uint         |     ✓      |      ✓      |         | uint               |             2 |
| r16sint         |     ✓      |      ✓      |         | sint               |             2 |
| r16float        |     ✓      |      ✓      |         | float              |             2 |
| rg8unorm        |     ✓      |      ✓      |         | float              |             2 |
| rg8snorm        |            |             |         | float              |             2 |
| rg8uint         |     ✓      |      ✓      |         | uint               |             2 |
| rg8sint         |     ✓      |      ✓      |         | sint               |             2 |
| r32uint         |     ✓      |             |    ✓    | uint               |             4 |
| r32sint         |     ✓      |             |    ✓    | sint               |             4 |
| r32float        |     ✓      |      ✓      |    ✓    | unfilterable-float |             4 |
| rg16uint        |     ✓      |      ✓      |         | uint               |             4 |
| rg16sint        |     ✓      |      ✓      |         | sint               |             4 |
| rg16float       |     ✓      |      ✓      |         | float              |             4 |
| rgba8unorm      |     ✓      |      ✓      |    ✓    | float              |             4 |
| rgba8unorm-srgb |     ✓      |      ✓      |         | float              |             4 |
| rgba8snorm      |            |             |    ✓    | float              |             4 |
| rgba8uint       |     ✓      |      ✓      |    ✓    | uint               |             4 |
| rgba8sint       |     ✓      |      ✓      |    ✓    | sint               |             4 |
| bgra8unorm      |     ✓      |      ✓      |         | float              |             4 |
| bgra8unorm-srgb |     ✓      |      ✓      |         | float              |             4 |
| rgb10a2unorm    |     ✓      |      ✓      |         | float              |             4 |
| rg11b10ufloat   |            |             |         | float              |             4 |
| rgb9e5ufloat    |            |             |         | float              |             4 |
| rg32uint        |     ✓      |             |    ✓    | uint               |             8 |
| rg32sint        |     ✓      |             |    ✓    | sint               |             8 |
| rg32float       |     ✓      |             |    ✓    | unfilterable-float |             8 |
| rgba16uint      |     ✓      |      ✓      |    ✓    | uint               |             8 |
| rgba16sint      |     ✓      |      ✓      |    ✓    | sint               |             8 |
| rgba16float     |     ✓      |      ✓      |    ✓    | float              |             8 |
| rgba32uint      |     ✓      |             |    ✓    | uint               |            16 |
| rgba32sint      |     ✓      |             |    ✓    | sint               |            16 |
| rgba32float     |     ✓      |             |    ✓    | unfilterable-float |            16 |

**フォーマット**

- 色の形式だが、必ずしも色を保存する必要はない
- `unorm`は、符号なし正規化データ（0~1）を表し、データが0からN（そのビット数の最大整数値）であることを意味する
- `snorm`は、符号付き正規化データ（-1~1）を表しので、データが-MからN（そのビット数の最小/最大整数値）であることを意味する
- `uint`は、符号なし整数
- `sint`は、符号付き整数
- `rg11b10ufloat`は、`rg11`はrgチャンネルがそれぞれ11ビット、`b10`はbチャンネルが10ビットで、`ufloat`はすべて符号なし浮動小数点数を表す

**レンダリング可能**

- `✓`は、レンダリングできることを意味する
- `GPUTextureUsage.RENDER_ATTACHMENT`を設定できる

**マルチサンプリング**

- マルチサンプリングができる

**ストレージ**

- ストレージテクスチャとして書き込むことができる

**サンプラータイプ**

- WGSLで宣言するテクスチャタイプを表す
  - `float`の場合は、`texture_2d<f32>`になる
  - `sint`の場合は、`texture_2d<i32>`になる
  - `uint`の場合は、`texture_2d<u32>`になる
- `unfilterable-float`
  - フィルターに`nearest`しか使用できない
  - pipelineを生成するときに`auto`レイアウトを使用できない
  - モバイルデバイスでは、32ビット浮動小数点テクスチャをフィルタリングできないため、拡張機能である`float32-filterable`をアダプターに要求する必要があるため

## 深度とステンシルの形式

| Format                | Renderable | Multisample | Storage | Sampler Type | Bytes per Pixel | Copy Src | Copy Dst | Feature               |
| :-------------------- | :--------: | :---------: | :-----: | :----------- | --------------: | :------: | :------: | :-------------------- |
| depth32float          |     ✓      |      ✓      |         | depth        |               4 |    ✓     |          |                       |
| depth16unorm          |     ✓      |      ✓      |         | depth        |               2 |    ✓     |    ✓     |                       |
| stencil8              |     ✓      |      ✓      |         | uint         |               1 |    ✓     |    ✓     |                       |
| depth24plus           |     ✓      |      ✓      |         | depth        |                 |          |          |                       |
| depth24plus-stencil8  |     ✓      |      ✓      |         | depth        |                 |          |          |                       |
| depth32float-stencil8 |     ✓      |      ✓      |         | depth        |                 |          |          | depth32float-stencil8 |
