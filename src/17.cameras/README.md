# カメラ

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-cameras.html

- 前回では、`mat4.perspective`関数が視点を原点`(0, 0, 0)`に置いていた
- 画面に表示させるには、オブジェクトを`-near ~ -far`の間に配置する必要があった

現実世界では、オブジェクトに合わせて`カメラを移動`させる。

- 逆行列は、もとの行列の作用を打ち消す作用をもつ

カメラを原点から移動・回転させる行列を作成し、その`逆行列をオブジェクトに作用させる`ことで、「カメラが原点にあり、その前にオブジェクトを移動させる」ことができる。

```ts
function render() {
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  // projection matrix
  const projection = mat4.perspective(degToRad(settings.fieldOfView), renderTarget.size.aspect, 1, 2000)

  // camera matrix
  const cameraMatrix = mat4.identity()
  mat4.rotateY(cameraMatrix, degToRad(settings.cameraAngle), cameraMatrix)
  mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix)

  // view matrix (inverse camera matrix)
  const viewMatrix = mat4.inverse(cameraMatrix)

  // [P][V]
  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  objectInfos.forEach(({ bindGroup, matrixValue, uniformBuffer, uniformValues }, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    // [VP][M]
    mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}
```

## Camera Aim

カメラを特定のオブジェクト（位置）に向かせたい。

- カメラの回転を計算するのは大変
- カメラの`位置`と`向かせたい方向`を指定できれば行列で表現できる

### 1. Z軸を求める

カメラの位置を`eye`，ターゲットの位置を`target`と置くと、ターゲットからカメラに向かうベクトルは以下のように求められる。

$$
zAxis = eye - target
$$

※カメラは`-Zを向いている`ため、`eye - target`となる


これは、カメラのローカル座標で見たときのZ軸にあたる。

<図>

正規化したベクトルを行列にすると、

$$
\begin{bmatrix}
0 & 0 & Z_{x} & 0 \\
0 & 0 & Z_{y} & 0 \\
0 & 0 & Z_{z} & 0 \\
0 & 0 & 0 & 0
\end{bmatrix}
$$

- 行列の部分は、カメラのZ軸を表す
- 3Dでは正規化されたベクトルは単位球上の点を表す

これだけでは、カメラの姿勢を表現できていないので、X軸，Y軸を求める必要がある。

### 2. X軸を求める

- それぞれの軸が直交していれば姿勢が定まる
- カメラを真上に向けることを考えない

これを考慮すると、以下を定義できる。

$$
up = (0, 1, 0)
$$

$up$と$zAxis$との`外積`をとることで、$xAxis$を求めることができる。

$$
xAxis = up \times zAxis
$$

<図>

### 3. Y軸を求める

同様に$zAxis$と$xAxis$の`外積`をとることで、$yAxis$を求めることができる。

$$
yAxis = zAxis \times xAxis
$$

<図>

以上より、CameraAim行列は

$$
CameraAim =
\begin{bmatrix}
X_{x} & Y_{x} & Z_{x} & T_{x} \\
X_{y} & Y_{y} & Z_{y} & T_{y} \\
X_{z} & Y_{z} & Z_{z} & T_{z} \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

$$
T: カメラの位置
$$

コードは以下のようになる。

```ts
cameraAim(eye: Vec3, target: Vec3, up: Vec3, dst?: Matrix) {
  dst = dst || new Float32Array(16)

  const zAxis = vec3.normalize(vec3.subtract(eye, target))
  const xAxis = vec3.normalize(vec3.cross(up, zAxis))
  const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis))

  return set(
    [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
        eye[0],   eye[1],   eye[2], 1,
    ],
    dst,
  )
},
// ----------------------------------------
function render() {
  renderTarget.update()

  const encoder = device.createCommandEncoder()

  const pass = encoder.beginRenderPass(renderTarget.renderPassDescriptor)
  pass.setPipeline(pipeline)
  pass.setVertexBuffer(0, vertexBuffer)

  // projection matrix
  const projection = mat4.perspective(degToRad(settings.fieldOfView), renderTarget.size.aspect, 1, 2000)

  // ターゲットにしたいFの位置
  const fPosition: [number, number, number] = [radius, 0, 0]

  // カメラの位置，回転（中心を向いている）
  const tempMatrix = mat4.rotationY(degToRad(settings.cameraAngle))
  mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix)

  // カメラの位置（T部分のみ）
  const eye = tempMatrix.slice(12, 15) as Float32Array

  // カメラの上ベクトル
  const up: [number, number, number] = [0, 1, 0]

  // ターゲット方向のカメラの姿勢
  const cameraMatrix = mat4.cameraAim(eye, fPosition, up)

  // view matrix
  const viewMatrix = mat4.inverse(cameraMatrix)

  const viewProjectionMatrix = mat4.multiply(projection, viewMatrix)

  objectInfos.forEach(({ bindGroup, matrixValue, uniformBuffer, uniformValues }, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue)

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices)
  })

  pass.end()

  device.queue.submit([encoder.finish()])
}
```

## Look At

数学ライブラリには`cameraAim`関数はなく、代わりに`lookAt`関数が用意されている。\
`lookAt`は、cameraAim行列の逆行列、つまり`viewMatrixを得る関数`。

$$
lookAt =
\begin{bmatrix}
cameraAim
\end{bmatrix}^{-1}
$$

```ts
lookAt(eye, target, up, dst) {
  return mat4.inverse(mat4.cameraAim(eye, target, up, dst), dst);
},
```

## Aim関数

camera aim関数は、用途としてcameraに限定されるものではなく、`キャラクターの頭をあるターゲットに追従させる`効果を持つ。\
例えば、「砲塔をターゲットに向ける」、「ジェットコースターの2番車両目を1車両目の尻に向ける」など。

何かを「狙う」Aim関数では、負のZ軸ではなく、正のZ軸で考えるため、以下のようなコードになる。

```ts
aim(eye: Vec3, target: Vec3, up: Vec3, dst?: Matrix) {
  dst = dst || new Float32Array(16)

  const zAxis = vec3.normalize(vec3.subtract(target, eye))
  const xAxis = vec3.normalize(vec3.cross(up, zAxis))
  const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis))

  return set(
    [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
        eye[0],   eye[1],   eye[2], 1,
    ],
    dst,
  )
},
```

<図>