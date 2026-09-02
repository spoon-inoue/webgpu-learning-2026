# 透視投影

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-perspective-projection.html

- 一般に3Dとして望まれる特性は`遠近感`で、遠近感をもつ投影を透視投影という
- 遠近感とは、遠くにあるものが小さく見える特徴
- 正射影には遠近感の特性がない

遠近感を簡単に達成する方法には、クリップ空間のXYの値をZで割る。

<img width="313" height="191" alt="orthographic-vs-perspective" src="https://github.com/user-attachments/assets/051f024e-d1b1-4ef3-a584-cd5fd1d95f02" />

- Zが大きくなるほど（つまり深度が遠いほど）、小さく遠くに見えるように描画される
- クリップ空間で除算すると、Zの範囲が`0から1に収まる`ため、より再現性が高くなる

```wgsl
let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
vsOut.position = vec4f(position.xy / zToDivideBy, position.zw);
```

- `fudgeFactor`は「調整係数」を意味し、この場合深度をスケールさせる

<投影方法の比較図>

WebGPUは、頂点シェーダーの戻り値`@builtin(position)`に割り当てたx, y, zを`パイプライン上で、wで除算する`。\
特にこれを「`透視除算（Perspective Divide）`」という。

これを利用すると上記のコードは以下のように書き直せる。

```wgsl
vsOut.position = vec4f(position.xyz, zToDivideBy);
```

行列にした場合は、以下のように表せられる。

$$
\begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & fudgeFactor & 1
\end{bmatrix}
\begin{bmatrix}
p_{x} \\
p_{y} \\
p_{z} \\
p_{w} \\
\end{bmatrix}
$$

$$
\begin{bmatrix}
p_{x} \\
p_{y} \\
p_{z} \\
p_{z} × fudgeFactor + p_{w} \\
\end{bmatrix}
$$

コードで書くと、以下のようになる。

```ts
// prettier-ignore
function makeZToWMatrix(fudgeFactor) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ];
}

// render
mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue)
```

## Zのクリップ空間

いままでのコードでは「F」が見切れてしまう。

<img width="791" height="391" alt="スクリーンショット 2026-09-01 094233" src="https://github.com/user-attachments/assets/1ea8455c-57f8-41cc-8035-2ef1fba62401" />

これは、Zがクリップ空間外に出ているからである。\
Zのクリップ空間は、`0 ~ 1`の範囲になる。（XYは、-1 ~ 1）

<img width="544" height="379" alt="スクリーンショット 2026-09-01 095342" src="https://github.com/user-attachments/assets/a857a371-dd7f-46b4-bd64-62e39966eb62" />

`Frustum（錐台）`は、円錐または角錐の上部が底面に平行な平面で切り取られたもの。

このクリップ空間を考慮した透視投影行列は以下のように記述できる。

$$
P=
\begin{bmatrix}
f / asp & 0 &              0 &                     0 \\
      0 & f &              0 &                     0 \\
      0 & 0 & far × rangeInv & near × far × rangeInv \\
      0 & 0 &             -1 &                     0 \\
\end{bmatrix}
$$

ここで、

$$
f = \tan\left(\frac{\pi}{2} - \frac{\mathrm{θ}}{2}\right)，\quad θ = fieldOfViewYInRadians
$$

$$
\mathrm{rangeInv} = \frac{1}{z_{near} - z_{far}}
$$

---

透視投影行列$P$を導出する。

<img width="640" height="500" alt="nRgAD" src="https://github.com/user-attachments/assets/c5d9d622-bc86-4607-85d9-8ea0a0375589" />

### 1. Y方向を求める

「ある \(z\) において、画面の一番上に来る \(y\) はいくつか？」を考える。

三角関数から、

$$
\tan\left(\frac{fovY}{2}\right) = \frac{y}{-z}
$$

$$
y = -z × \tan\left(\frac{fovY}{2}\right)
$$

fを以下のように定義すると、

$$
f = \frac{1}{\tan\left(\frac{fovY}{2}\right)}
$$

yは以下のように表せる。

$$
y = -\frac{z}{f}
$$

---

### 2. Yを-1 ~ 1に変換する

最終的には、以下のようにしたい。

$$
y_{ndc} = 1
$$

視錐台上端は、

$$
y_{max} = -\frac{z}{f}
$$

つまり、

$$
y_{ndc} = \frac{y}{y_{max}} = \frac{fy}{-z}
$$

---

### 3. 「行列 + Perspective Divide」に分解する

WebGPUでは、頂点シェーダーの戻り値

$$
(x_{clip}, y_{clip}, z_{clip}, w_{clip})
$$

に対して、

$$
x_{clip} = \frac{x_{clip}}{w_{clip}}，
y_{clip} = \frac{y_{clip}}{w_{clip}}，
z_{clip} = \frac{z_{clip}}{w_{clip}}
$$

という`Perspective Divide`が行われる。

2.で求めた、

$$
y_{ndc} = \frac{fy}{-z}
$$

を見ると、以下のように分解できる。

$$
y_{clip} = fy
$$

$$
w_{clip} = -z
$$

ここまでを行列で表すと以下のようになる。

$$
P=
\begin{bmatrix}
? & 0 &  0 & 0 \\
0 & f &  0 & 0 \\
0 & 0 &  ? & ? \\
0 & 0 & -1 & 0
\end{bmatrix}
$$

---

### 4. X方向はアスペクト比を考慮する

Xでは、画面アスペクト比を使って求めていく。

$$
a = \frac{width}{height}
$$

また、Yは以下なので、

$$
y_{clip} = fy
$$

Xは、以下のように表せる。

$$
x_{clip} = \frac{f}{a}x
$$

導出

$$
y_{max} = \frac{-z}{f}
$$

$$
x_{max} = a \times y_{max} = a \frac{-z}{f}
$$

$$
x_{ndc} = \frac{x}{x_{max}}
$$

$$
x_{ndc} = \frac{fx}{-az}
$$

$$
w_{clip} = -z
$$

$$
x_{clip} = \frac{f}{a}x
$$

ここまでを行列で表すと以下のようになる。

$$
P=
\begin{bmatrix}
f/a & 0 &  0 & 0 \\
0 & f &  0 & 0 \\
0 & 0 &  ? & ? \\
0 & 0 & -1 & 0
\end{bmatrix}
$$

---

### 5. Z方向について考える

以下のように変換する。

$$
z = -near → z_{ndc} = 0
$$

$$
z = -far → z_{ndc} = 1
$$

また、`Perspective Divide`があるため、最終的には以下の形になる。

$$
z_{ndc} = \frac{s}{z} + c
$$

導出

$$
\begin{aligned}
\begin{bmatrix}
\frac{f}{a} & 0 & 0 & 0 \\
0 & f & 0 & 0 \\
0 & 0 & A & B \\
0 & 0 & -1 & 0
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
\end{aligned}
$$

$$
z_{\mathrm{clip}} = Az + B
$$

$$
w_{\mathrm{clip}} = -z
$$

$$
z_{\mathrm{ndc}}
= \frac{z_{\mathrm{clip}}}{w_{\mathrm{clip}}}
= \frac{Az}{-z} + \frac{B}{-z}
= -A - \frac{B}{z}
$$

$$
z_{\mathrm{ndc}} = \frac{s}{z} + c
$$

$$
s = -B, \qquad c = -A
$$

この未知数`s`, `c`を求める。

> [!IMPORTANT]
> WebGPUでは、$z_{ndc} \in [0, 1]$
> WebGLでは、$z_{ndc} \in [-1, 1]$

> [!NOTE]
> なぜ、zは以下の形で表されるのか
> $$
> z_{clip} = Az + B
> $$
> nearとfarの2変数を変換し、$w_{clip}$で割った時に$z_{ndc}$となるような$z_{clip}$を求める必要があるため。
> $$
> near → 0, \quad far → 1, \quad z_{ndc} = \frac{z_{clip}}{w_{clip}}
> $$

---

### 6. near / far の条件を代入する

nearでは、

$$
z = -near
$$

の時に、以下にしたい。

$$
z_{ndc} = 0
$$

つまり、

$$
\frac{s}{-near} + c = 0
$$

farでは、

$$
z = -far
$$

の時に、以下にしたい。

$$
z_{ndc} = 1
$$

つまり、

$$
\frac{s}{-far} + c = 1
$$

したがって、以下の連立方程式を解けばよい。

$$
\left\{
\begin{array}{rcl}
\displaystyle \frac{s}{-near} + c &=& 0 \qquad (1) \\[1em]
\displaystyle \frac{s}{-far}  + c &=&  1 \qquad (2)
\end{array}
\right.
$$

以降、

$$
near = N \\
far = F
$$

とする。

---

### 7. s, cを求める

`s`について、$(2) - (1)$をすると、

$$
\frac{s}{-F} - \frac{s}{-N} = 1 \\[1em]

\frac{s \times N}{-F \times N} - \frac{s \times F}{-N \times F} = 1 \\[1em]

s\frac{N - F}{-N \times F} = 1 \\[1em]

s = \frac{NF}{F - N}
$$

`c`について、$(1)$に`s`を代入すると、

$$
\frac{s}{-N} + c = 0 \\[1em]

c = s \times \frac{1}{N} = \frac{NF}{F - N} \times \frac{1}{N} \\[1em]

c = \frac{F}{F - N}
$$

---

### 8. 行列の形に変換する

以上より

$$
z_{ndc} = \frac{s}{z} + c \\[1em]
z_{ndc} = \frac{NF}{F - N} \times \frac{1}{z} + \frac{F}{F - N} \\[1em]
$$

ここで、

$$
w_{clip} = -z \\[1em]
z_{clip} = z_{ndc} \times w_{clip}
$$

なので、

$$
z_{clip} = \left(\frac{NF}{F - N} \times \frac{1}{z} + \frac{F}{F - N}\right) \times -z \\[1em]

z_{clip} = \frac{F}{N - F}z + \frac{NF}{N - F}
$$


以上より、

$$
P=
\begin{bmatrix}
\frac{f}{a} & 0 &  0 & 0 \\
0 & f &  0 & 0 \\
0 & 0 &  \frac{F}{N - F} & \frac{NF}{N - F} \\
0 & 0 & -1 & 0
\end{bmatrix}
$$

コードと一致する。

```ts
perspective(fieldOfViewYInRadians: number, aspect: number, zNear: number, zFar: number, dst?: Matrix) {
  dst = dst || new Float32Array(16);

  const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
  const rangeInv = 1 / (zNear - zFar);

  return set([
    f / aspect, 0,                       0,  0,
             0, f,                       0,  0,
             0, 0,         zFar * rangeInv, -1,
             0, 0, zNear * zFar * rangeInv,  0,
  ], dst)
},
```

### 行列の意味

| 項    | 説明                       |
| :---- | :------------------------- |
| f / a | Xを視錐台内から[-1, 1]へ   |
| f     | Yを視錐台内から[-1, 1]へ   |
| -1    | w = -zを作り透視除算させる |
| Z部分 | [-N, -F]を[0, 1]へ         |
