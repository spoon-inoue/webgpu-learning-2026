# TRS

TRSは、`Transition Rotation Scale`の略称

## 平行移動

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-translation.html

平行移動は、Vertex Shader内で、positionに値を加算をして頂点位置を動かすこと。

```wgsl
let position = vert.position + uni.translation;
```

### ピクセル座標からクリップ座標への変換

Vertex Shaderの戻り値`position`は、wで割ったときに`正規化デバイス座標系（NDC）`になるような座標系（クリップ座標系）である必要がある。

| 座標系               | 値のとる範囲        |
| :------------------- | :------------------ |
| クリップ座標系       | -w <= x, y, z <= +w |
| 正規化デバイス座標系 | -1 <= x, y, z <= +1 |

```wgsl
// position（vec2f）は、px単位
let zeroToOne        = position / uni.resolution;       // 0 ~ 1
let zeroToTwo        = zeroToOne * 2.0;                 // 0 ~ 2
let flippedClipSpace = zeroToTwo - 1.0;                 // -1 ~ 1
let clipSpace        = flippedClipSpace * vec2f(1, -1); // Y座標を反転する
vsOut.position       = vec4f(clipSpace, 0.0, 1.0);      // wが1なので、clipSpace = ndc となっている
```

## 回転

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-rotation.html

回転は、Vertex Shader内で、positionに値を加算，乗算をして頂点位置を動かすこと。

```wgsl
let rotatedPosition = vec2f(
  vert.position.x * uni.rotation.x - vert.position.y * uni.rotation.y,
  vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x
);
```

$$
\begin{bmatrix}
r_{x} & -r_{y} \\
r_{y} &  r_{x} \\
\end{bmatrix}
\begin{bmatrix}
p_{x} \\
p_{y} \\
\end{bmatrix}
$$

$$
\begin{bmatrix}
cos(θ) & -sin(θ) \\
sin(θ) &  cos(θ) \\
\end{bmatrix}
\begin{bmatrix}
p_{x} \\
p_{y} \\
\end{bmatrix}
$$

[回転行列の導出](https://w3e.kanazawa-it.ac.jp/math/category/gyouretu/senkeidaisu/henkan-tex.cgi?target=/math/category/gyouretu/senkeidaisu/rotation_matrix_2d.html)

### 単位

数学計算ではラジアン`radian`、人間にわかりやすいのは度`degree`

## スケール

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-scale.html

回転は、Vertex Shader内で、positionに値を乗算をして頂点位置を拡縮すること。

```wgsl
let scaledPosition = vert.position * uni.scale;
```

- マイナスの値を乗算すると反転する
- `(0, 0)`を基準にスケールするため、Fの中心からスケールしたい場合は、事前に平行移動させる必要がある。

## 行列演算

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-matrix-math.html

- TRSでは、作用させる順番でその結果が変わる
- 順番を変えるためには別のシェーダを用意する必要がある

行列を使うと`TRSの作用を複合`できる。そのため、ひとつのシェーダで複数の作用の順番を表現できる。

**平行移動行列 T**

$$
\mathbf{T} =
\begin{bmatrix}
1 & 0 & t_{x} \\
0 & 1 & t_{y} \\
0 & 0 &     1 \\
\end{bmatrix}
$$

```ts
x' = x + tx
y' = y + ty
```

**回転行列 R**

$$
\mathbf{R} =
\begin{bmatrix}
c & -s & 0 \\
s &  c & 0 \\
0 &  0 & 1 \\
\end{bmatrix}
$$

$$
c = cos(θ), s = sin(θ)
$$

```ts
x' = x * c - y * s
y' = x * s + y * c
```

**スケール行列 S**

$$
\mathbf{S} =
\begin{bmatrix}
s_{x} &     0 & 0 \\
    0 & s_{y} & 0 \\
    0 &     0 & 1 \\
\end{bmatrix}
$$

```ts
x' = x * sx
y' = y * sy
```

TRSの順番で複合させたマトリクスを作成する場合

$$
\mathbf{M} = \mathbf{T}\mathbf{R}\mathbf{S}
$$

```ts
const translationMatrix = mat3.translation(settings.translation)
const rotationMatrix = mat3.rotation(settings.rotation)
const scaleMatrix = mat3.scaling(settings.scale)

let matrix = mat3.multiply(translationMatrix, rotationMatrix)
matrix = mat3.multiply(matrix, scaleMatrix)
```

シェーダでは、マトリクスを頂点位置に乗算するだけ

```wgsl
let position = (uni.matrix * vec3f(vert.position, 1)).xy;
```

---

### Column-major order（列優先）

[GLSL のデータ型とコンストラクタの挙動まとめ](https://blog.oimo.io/2022/03/27/glsl-types/)

WGSL(GLSL)で扱われるマトリクスは`Column-major order`になっている。普段見慣れている（数学的に扱われる）マトリクスは`Row-major order`になっている。

#### mat4x4f は「4列の vec4」

例えば、以下の4x4行列がある場合、

$$
\begin{bmatrix}
m_{00} & m_{01} & m_{02} & m_{03} \\
m_{10} & m_{11} & m_{12} & m_{13} \\
m_{20} & m_{21} & m_{22} & m_{23} \\
m_{30} & m_{31} & m_{32} & m_{33}
\end{bmatrix}
$$

WGLSでは、これを`列ごと`に保持する。

| column 0 | column 1 | column 2 | column 3 |
| :------- | :------- | :------- | :------- |
| m00      | m01      | m02      | m03      |
| m10      | m11      | m12      | m13      |
| m20      | m21      | m22      | m23      |
| m30      | m31      | m32      | m33      |

メモリ上では、以下のように格納される。

```
m00, m10, m20, m30,  <- column 0
m01, m11, m21, m31,  <- column 1
m02, m12, m22, m32,  <- column 2
m03, m13, m23, m33,  <- column 3
```

#### WGSLのコンストラクタも「列」で指定する

WGSLで以下のようなマトリクスを作成した場合、

```wgsl
let m = mat4x4f(
  1.0,  2.0,  3.0,  4.0,
  5.0,  6.0,  7.0,  8.0,
  9.0, 10.0, 11.0, 12.0,
 13.0, 14.0, 15.0, 16.0,
);
```

$$
\begin{bmatrix}
1  &  2 &  3 &  4 \\
5  &  6 &  7 &  8 \\
9  & 10 & 11 & 12 \\
13 & 14 & 15 & 16
\end{bmatrix}
$$

ではなく、

$$
\begin{bmatrix}
1  &  5 &  9 & 13 \\
2  &  6 & 10 & 14 \\
3  &  7 & 11 & 15 \\
4  &  8 & 12 & 16
\end{bmatrix}
$$

になる。

#### matrix[column][row] でアクセスする

```wgsl
let column = m[0]; // column 0 -> [1, 5, 9, 13]
let a = m[2][1];   // column 2, row 1 -> 7
```

#### 平行移動行列の場合

数学的には以下のように表される。

$$
\begin{bmatrix}
1 & 0 & 0 & t_{x} \\
0 & 1 & 0 & t_{y} \\
0 & 0 & 1 & t_{z} \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

Column-majorで格納すると、

| column 0 | column 1 | column 2 | column 3 |
| :------- | :------- | :------- | :------- |
| 1        | 0        | 0        | tx       |
| 0        | 1        | 0        | ty       |
| 0        | 0        | 1        | tz       |
| 0        | 0        | 0        | 1        |

そのため、WGSLでは以下のように定義する。

```wgsl
let m = mat4x4f(
   1,  0,  0, 0, // column 0
   0,  1,  0, 0, // column 1
   0,  0,  1, 0, // column 2
  tx, ty, tz, 1, // column 3
);
```

JavaScript側でも、以下のように定義する。

```ts
// prettier-ignore
const matrix = new Float32Array([
   1,  0,  0, 0,
   0,  1,  0, 0,
   0,  0,  1, 0,
  tx, ty, tz, 1,
])
```

回転行列も、WGSLでは以下が正しい。

$$
\begin{bmatrix}
cos(θ) & -sin(θ) \\
sin(θ) & cos(θ) \\
\end{bmatrix}
$$

```wgsl
let m = mat2x2f(
   c, s,
  -s, c,
);
```

---

### 行列の柔軟性

#### 作用順番の変更

平行移動 → 回転 → スケール

```ts
const translationMatrix = mat3.translation(settings.translation)
const rotationMatrix = mat3.rotation(settings.rotation)
const scaleMatrix = mat3.scaling(settings.scale)

// M = TRS
let matrix = mat3.multiply(translationMatrix, rotationMatrix)
matrix = mat3.multiply(matrix, scaleMatrix)
```

スケール → 回転 → 平行移動

```ts
const translationMatrix = mat3.translation(settings.translation)
const rotationMatrix = mat3.rotation(settings.rotation)
const scaleMatrix = mat3.scaling(settings.scale)

// M = SRT
let matrix = mat3.multiply(scaleMatrix, rotationMatrix)
matrix = mat3.multiply(matrix, translationMatrix)
```

#### 階層的な行列適用

行列を使うと、例えば地球における月のような「`何かに付随する動き`」を表現できる。

```ts
let matrix = mat3.identity()

// TRS -> TRS -> ...
for (const {} of objectInfos) {
  matrix = mat3.multiply(matrix, translationMatrix)
  matrix = mat3.multiply(matrix, rotationMatrix)
  matrix = mat3.multiply(matrix, scaleMatrix)

  // prettier-ignore
  matrixValue.set([
    ...matrix.slice(0, 3), 0, 
    ...matrix.slice(3, 6), 0, 
    ...matrix.slice(6, 9), 0
  ])

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(numVertices)
}
```

<図>

#### 回転、スケールの中心の変更

```ts
const translationMatrix = mat3.translation(settings.translation)
const rotationMatrix = mat3.rotation(settings.rotation)
const scaleMatrix = mat3.scaling(settings.scale)
// 「F」の原点をその中心に移動する
const moveOriginMatrix = mat3.translation([-50, -75])

// M = TRSM
let matrix = mat3.multiply(translationMatrix, rotationMatrix)
matrix = mat3.multiply(matrix, scaleMatrix)
matrix = mat3.multiply(matrix, moveOriginMatrix)
```

---

### 射影の行列化

ピクセル座標からクリップ座標に変換する処理もマトリクスにまとめることができる。

```wgsl
// position（vec2f）は、px単位
let zeroToOne        = position / uni.resolution;       // 0 ~ 1
let zeroToTwo        = zeroToOne * 2.0;                 // 0 ~ 2
let flippedClipSpace = zeroToTwo - 1.0;                 // -1 ~ 1
let clipSpace        = flippedClipSpace * vec2f(1, -1); // Y座標を反転する
```

作用させる順番に気を付けると、以下のようになる。

$$
\mathbf{M} = \mathbf{F}\mathbf{T}\mathbf{S_{2}}\mathbf{S_{r}} \\
\mathbf{P_{clip}} = \mathbf{M}\mathbf{P_{pixel}}
$$

$$
\mathbf{M} =
\begin{bmatrix}
1 &  0 & 0 \\
0 & -1 & 0 \\
0 &  0 & 1 \\
\end{bmatrix}
\begin{bmatrix}
1 & 0 & -1 \\
0 & 1 & -1 \\
0 & 0 &  1 \\
\end{bmatrix}
\begin{bmatrix}
2 & 0 & 0 \\
0 & 2 & 0 \\
0 & 0 & 1 \\
\end{bmatrix}
\begin{bmatrix}
1/r_{x} &       0 & 0 \\
      0 & 1/r_{y} & 0 \\
      0 &       0 & 1 \\
\end{bmatrix}
$$

$$
\mathbf{M} =
\begin{bmatrix}
1 &  0 & -1 \\
0 & -1 &  1 \\
0 &  0 &  1 \\
\end{bmatrix}
\begin{bmatrix}
2 & 0 & 0 \\
0 & 2 & 0 \\
0 & 0 & 1 \\
\end{bmatrix}
\begin{bmatrix}
1/r_{x} &       0 & 0 \\
      0 & 1/r_{y} & 0 \\
      0 &       0 & 1 \\
\end{bmatrix}
$$

$$
\mathbf{M} =
\begin{bmatrix}
2 &  0 & -1 \\
0 & -2 &  1 \\
0 &  0 &  1 \\
\end{bmatrix}
\begin{bmatrix}
1/r_{x} &       0 & 0 \\
      0 & 1/r_{y} & 0 \\
      0 &       0 & 1 \\
\end{bmatrix}
$$

$$
\mathbf{M} =
\begin{bmatrix}
2/r_{x} &        0 & -1 \\
      0 & -2/r_{y} &  1 \\
      0 &        0 &  1 \\
\end{bmatrix}
$$

```ts
projection(width: number, height: number) {
  // prettier-ignore
  return [
    2 / width,           0,  0,
            0, -2 / height,  0,
           -1,           1,  1,
  ]
},
```

そして、TRSのマトリクスと組み合わせると、以下のように集約できる。

```ts
const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight)
const translationMatrix = mat3.translation(settings.translation)
const rotationMatrix = mat3.rotation(settings.rotation)
const scaleMatrix = mat3.scaling(settings.scale)

// M = PTRSM
let matrix = mat3.multiply(projectionMatrix, translationMatrix)
matrix = mat3.multiply(matrix, rotationMatrix)
matrix = mat3.multiply(matrix, scaleMatrix)
matrix = mat3.multiply(matrix, moveOriginMatrix)
```

---

### 作用の見方

```
射影行列 * 平行移動行列 * 回転行列 * スケール行列 * 位置
```

見方の話なので「理解しやすい方でOK」

- 作用を右から読む場合は、`位置`に対する作用になる
- 作用を左から読む場合は、`空間`に対する作用になる

空間への作用を考える。

射影行列（ $\mathbf{F}\mathbf{T}\mathbf{S_{2}}\mathbf{S_{r}}$ ）について

| 順番 | Matrix           | 空間                   |
| :--- | :--------------- | :--------------------- |
| 1    |                  | -1 ~ 1（クリップ空間） |
| 2    | $\mathbf{F}$     | Yが反転する            |
| 3    | $\mathbf{T}$     | 0 ~ 2                  |
| 4    | $\mathbf{S_{2}}$ | 0 ~ 1                  |
| 5    | $\mathbf{S_{r}}$ | 0 ~ resolution         |

Transform行列（ $\mathbf{T}\mathbf{R}\mathbf{S}$ ）について

| 順番 | Matrix       | 空間         |
| :--- | :----------- | :----------- |
| 6    | $\mathbf{T}$ | 平行移動する |
| 7    | $\mathbf{R}$ | 回転する     |
| 8    | $\mathbf{S}$ | スケールする |

---

よりベクトルやマトリクスについて知りたい場合は、以下の動画がおすすめ

[線形代数のエッセンス | 3Blue1BrownJapan](https://www.youtube.com/watch?v=ZXuZHNjS2tA&list=PL5WufEA7WHQGX7Su06JzbPDXUQGOd0wlq)
