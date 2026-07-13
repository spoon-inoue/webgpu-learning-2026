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

Uniformを扱うためのGPU Bufferを生成する

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

#### メモリレイアウトについて

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
