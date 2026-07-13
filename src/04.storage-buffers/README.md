## Storage BufferをThree.jsで表現する

three.js（WebGL2）には、storage bufferという仕組みがない。  
[Data Texture](https://threejs.org/docs/#DataTexture)を使用して、疑似的にstorage bufferを表現する。(してみる)

### Storage BufferとData Textureの違い

|              | Storage Buffer             | Data Texture               |
| :----------- | :------------------------- | :------------------------- |
| 形状         | 1次元配列                  | 2次元配列                  |
| wgslでの参照 | array[n]                   | texture(dataMap, uv)       |
| bufferの更新 | device.queue.writeBuffer() | texture.needsUpdate = true |

### Data Textureの参照の考え方

例えば、以下のような構造のData Textureがあるとする。

```ts
// color(vec4f), offset(vec2f)を扱うData Textureだとすると要素数は、
// (color + offset) * numObjects
const numObjects = 100
const stride = 4 + 2
const datasView = new Float32Array(stride * numObjects)

// データ数 x 1 の1次元配列
// 配列要素数は1つのみでいいので、RedFormat
// データ型は、Float
const dataTexture = new THREE.DataTexture(datasView, datasView.length, 1, THREE.RedFormat, THREE.FloatType)

for (let i = 0; i < numObjects; i++) {
  // color
  datasView[i * stride + 0] = rand()
  datasView[i * stride + 1] = rand()
  datasView[i * stride + 2] = rand()
  datasView[i * stride + 3] = 1
  // offset
  datasView[i * stride + 4] = rand(-0.9, 0.9)
  datasView[i * stride + 5] = rand(-0.9, 0.9)
}
// gpu bufferに書き込む
dataTexture.needsUpdate = true
```

構造は以下のようになる。  
<図>

このData Textureは、shaderで0~1の範囲で参照されるため、以下のように考える。

```glsl
  // data.px = 1. / datasView.length

  float instanceOffset = float(gl_InstanceID) / kNumObjects;
  vec2 center = vec2(data.px, 1) * 0.5;

  vec4 color = vec4(
    texture(data.map, vec2(instanceOffset + data.px * 0., 0) + center).x,
    texture(data.map, vec2(instanceOffset + data.px * 1., 0) + center).x,
    texture(data.map, vec2(instanceOffset + data.px * 2., 0) + center).x,
    texture(data.map, vec2(instanceOffset + data.px * 3., 0) + center).x
  );

  vec2 offset = vec2(
    texture(data.map, vec2(instanceOffset + data.px * 4., 0) + center).x,
    texture(data.map, vec2(instanceOffset + data.px * 5., 0) + center).x
  );
```
