# テクスチャへの画像の読み込み

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-importing-textures.html

- `device.queue.copyExternalImageToTexture`
  - 画像をテクスチャにコピーする
  - `ImageBitmap`を受け取ることができる

## 画像の読み込み

- ImageBitmapを生成する
- colorSpaceConversion
  - 色空間を適用するかどうか
- `flipY`でテクスチャを反転させる

```ts
async function loadImageBitmap(url: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  return await createImageBitmap(blob, { colorSpaceConversion: 'none' })
}

const url = import.meta.env.BASE_URL + 'assets/images/f-texture.png'
const source = await loadImageBitmap(url)
const texture = device.createTexture({
  label: url,
  format: 'rgba8unorm',
  size: [source.width, source.height],
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
})

// prettier-ignore
device.queue.copyExternalImageToTexture(
  { source, flipY: true }, 
  { texture }, 
  { width: source.width, height: source.height }
)
```

### 色空間とは

- 色空間は「色を数値で表現するための基準」
- RGB値だけでは色は決まらず、「どの色空間か」が必要
- 色空間は主に「色域」「白色点」「ガンマ（伝達関数）」を定義する
- Webでは `sRGB` が標準、Apple製品では `Display P3` も広く使われる
- WebGPUやThree.jsでは、計算は Linear sRGB、表示は sRGB が基本的なワークフローとなる
- `colorSpaceConversion: 'default'`
  - 画像の色空間（Display P3やAdobe RGBなど）を描画用色空間（sRGB）へ変換する
- `format: 'rgba8unorm-srgb'`
  - テクスチャの値は「sRGBエンコードされた色」として扱われ、サンプリング時にGPUがLinear RGBへデコードする

| colorSpaceConversion | texture format    | `textureSample()`で得る値                            |
| :------------------- | :---------------- | :--------------------------------------------------- |
| `default`            | `rgba8unorm-srgb` | ブラウザが色空間を調整し、GPUがsRGB→Linear変換       |
| `default`            | `rgba8unorm`      | ブラウザが色空間を調整し、その符号化値をそのまま取得 |
| `none`               | `rgba8unorm-srgb` | 元の符号化値をsRGBとして解釈し、Linearへ変換         |
| `none`               | `rgba8unorm`      | 元の符号化値を数値としてそのまま取得                 |

## GPUでミップを生成する

前回（以下）の作成方法だと効率が悪い。

- 画像を2Dキャンバスに描画し、getImageDataを呼び出してデータを取得し、最後にミップを生成してアップロードする
- 高解像度の画像データになるほど負荷が高くなる（width x heightループ処理のため）

ミップレベルを生成するときに、バイリニア補間が必要だったが、これはGPUが`minFilter: linear`で行うことと同じで、この機能を使ってミップレベルを生成できる。

### ミップレベルを作成する

```ts
function numMipLevels(...sizes: number[]) {
  const maxSize = Math.max(...sizes)
  return 1 + (Math.log2(maxSize) | 0)
}
```

- `Math.log2`
  - 数値を生成するために必要な2のべき乗を得る
  - 数値を2で何回割ることができるかを教えてくれる

例えば、`numMipLevels(123, 456)`は`9`を返す

```
レベル0：123、456
レベル1：61、228
レベル2：30、114
レベル3：15、57
レベル4：7、28
レベル5：3、14
レベル6：1、7
レベル7：1、3
レベル8：1、1
```

### 描画

- 1つ前のMipLevelのテクスチャをsourceとして、現在のMipLevelのテクスチャに書き込む
- sourceよりも書き込み先の解像度の方が低いのため、samplerに設定した`minFilter: 'linear'`補間がされる

```ts
const generateMips = (() => {
  let sampler: GPUSampler | null = null
  let module: GPUShaderModule | null = null
  const pipelineByFormat: { [key in GPUTextureFormat]?: GPURenderPipeline } = {}

  return function generateMips(device: GPUDevice, texture: GPUTexture) {
    if (!module) {
      module = device.createShaderModule({ code: shader })
    }
    if (!sampler) {
      sampler = device.createSampler({ minFilter: 'linear' })
    }

    if (!pipelineByFormat[texture.format]) {
      pipelineByFormat[texture.format] = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module },
        fragment: { module, targets: [{ format: texture.format }] },
      })
    }
    const pipeline = pipelineByFormat[texture.format]!

    const encoder = device.createCommandEncoder({ label: 'mip gen encoder' })

    for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; baseMipLevel++) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView({ baseMipLevel: baseMipLevel - 1, mipLevelCount: 1 }) },
        ],
      })

      const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'our basic canvas renderPass',
        colorAttachments: [
          {
            view: texture.createView({ baseMipLevel, mipLevelCount: 1 }),
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

    device.queue.submit([encoder.finish()])
  }
})()
```

## キャンバスの読み込み

Canvas2Dに描画した内容から、Mipmap付きのTextureを生成して描画ソースとして扱う

```ts
export function copySourceToTexture(device: GPUDevice, texture: GPUTexture, source: ImageBitmap | HTMLCanvasElement, options?: Options) {
  // prettier-ignore
  device.queue.copyExternalImageToTexture(
    { source, flipY: options?.flipY }, 
    { texture }, 
    { width: source.width, height: source.height }
  )

  if (texture.mipLevelCount > 1) {
    generateMips(device, texture)
  }
}
```

- `copyExternalImageToTexture`は、`ImageBitmap`の他に`HTMLCanvasElement`もsourceとして受け取ることができる

## Videoの読み込み

Video要素（HTMLVideoElement）を通して、VideoソースをTextureソースとして扱える

---

videoの幅、高さは、`videoWidth`, `videoHeight`で取得できる

```ts
function getSourceSize(source: Source): [number, number] {
  if (source instanceof HTMLVideoElement) {
    return [source.videoWidth, source.videoHeight]
  } else {
    return [source.width, source.height]
  }
}
```

---

[`requestVideoFrameCallback`](https://developer.mozilla.org/ja/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)を使うことで、最初のフレームが読み込まれたタイミングを知ることができる

```ts
function startPlayingAndWaitForVideo(video: HTMLVideoElement) {
  return new Promise((resolve, reject) => {
    video.addEventListener('error', reject)
    video.requestVideoFrameCallback(resolve)
    video.play().catch(reject)
  })
}
```

---

videoの開始には、ユーザーの操作が必要（※音声を扱う場合）

```ts
function waitForClick() {
  return new Promise((resolve) => {
    const startBtn = document.querySelector<HTMLButtonElement>('.video-start')!
    startBtn.addEventListener(
      'click',
      () => {
        resolve(null)
        startBtn.style.setProperty('display', 'none')
      },
      { once: true },
    )
  })
}
```

---

`device.query.copyExternalImageToTexture`は時間のかかる処理（負荷の高い処理）なため、仮にビデオが30fpsで、描画レートが120fpsの場合、それに合わせて毎フレームテクスチャを更新する必要はなく、`requestVideoFrameCallback`が呼ばれたタイミング（videoのframe更新）でテクスチャの更新を行うと負荷軽減になる。

```ts
let haveNewVideoFrame = false
function recordHaveNewFrame() {
  haveNewVideoFrame = true
  video.requestVideoFrameCallback(recordHaveNewFrame)
}
video.requestVideoFrameCallback(recordHaveNewFrame)
```

## テクスチャアトラス

1つのモデルに対して、複数のテクスチャを使う場合、つまり、1回のdraw callで複数のテクスチャを扱うにはどのようにすればいいか。

- テクスチャをその都度バインドすると、数が増えるたびにGPUに確保するメモリが増えて負荷が高くなる
- バインドできるテクスチャには上限値がある
  | パラメータ                       | 制限値 |
  | :------------------------------- | -----: |
  | maxSampledTexturesPerShaderStage |     48 |

一般的な解決方法として「テクスチャアトラス」と呼ばれる手法がある。

- 複数の画像を1枚の画像（テクスチャ）にまとめる手法
- テクスチャ座標を計算して、使用したい画像の位置を選択する
- 扱えるテクスチャサイズの制限値を超えないように注意する
  | パラメータ            | 制限値（def） |
  | :-------------------- | ------------: |
  | maxTextureDimension2D |  16384 (8192) |

Cube前面の位置とテクスチャ座標

```ts
const vertexData = new Float32Array([
    //  位置   |  テクスチャ座標
    //-------------+----------------------
    // 前面     左上の画像を選択
   -1,  1,  1,        0   , 0  ,
   -1, -1,  1,        0   , 0.5,
    1,  1,  1,        0.25, 0  ,
    1, -1,  1,        0.25, 0.5,
```
