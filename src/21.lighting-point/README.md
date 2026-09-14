# 点光源

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-lighting-point.html

## 点光源

- 指向性ライティングの場合、ライトの方向（ベクトル）をUniformで渡した
- 点光源の場合、3D空間内の`光源の位置`をUniformで渡し、モデル表面上から光源までの方向（surfaceToLight）をそれぞれ求める

<img width="600" alt="スクリーンショット 2026-09-14 163644" src="https://github.com/user-attachments/assets/af365963-8411-4062-9dd1-bb8c165b9ff9" />

指向性ライティングと同様に、`surfaceToLightと法線との内積`を用いて光の影響を反映できる。

```wgsl
@vertex fn vs(vert: Vertex) -> VSOut {
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  return VSOut(
    uni.worldViewProjection * vert.position,  // position
    uni.normalMatrix * vert.normal,           // normal
    uni.lightPosition - surfaceWorldPosition, // surfaceToLight
  );
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let surfaceToLightDirection = normalize(in.surfaceToLight);
  let light = dot(normal, surfaceToLightDirection);

  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}
```

- `uni.world`は、worldMatrixでpositionを全体座標系に変換する
- シェーダー間変数で、表面の位置からライトまでのベクトル`surfaceToLight`を得る

## スペキュラー

`スペキュラー（Specular）`とは、3DCGや物理学における物体表面での鏡面反射や光沢・ハイライトを指す。

<img width="300" alt="specular-highlights" src="https://github.com/user-attachments/assets/1a6036eb-751a-4fa8-90aa-e64fa63d86c2" />

`反射した光がどれくらい目に入るか`を計算することで、この効果を再現できる。

物体表面にあたって反射した光は、物体の法線に対する入射角と同じ角度で最大となる。\
そのため、「正規化した表面位置から視点（View）へのベクトル`surfaceToView`と、正規化した`surfaceToLight`ベクトルの和`halfVector`」と、「法線`surface normal`」との内積をとることで反射した光の強さを再現することができる。

<img width="600" alt="スクリーンショット 2026-09-14 164010" src="https://github.com/user-attachments/assets/8bfb2c3f-98f7-4846-bd43-13844ee03a54" />

```wgsl
@vertex fn vs(vert: Vertex) -> VSOut {
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  return VSOut(
    uni.worldViewProjection * vert.position,       // position
    uni.normalMatrix * vert.normal,                // normal
    uni.lightWorldPosition - surfaceWorldPosition, // surfaceToLight
    uni.viewWorldPosition - surfaceWorldPosition,  // surfaceToView
  );
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let surfaceToLightDirection = normalize(in.surfaceToLight);
  let light = dot(normal, surfaceToLightDirection);

  let surfaceToViewDirection = normalize(in.surfaceToView);
  let halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);
  var specular = dot(normal, halfVector);

  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

```ts
const eye = [100, 150, 200]
// ...
views.viewWorldPosition.set(eye)
```

>[!TIP]
>Uniformが多くなると管理しきれなくなるので、`webgpu-utils`を使う。

<img width="500" alt="スクリーンショット 2026-09-14 164322" src="https://github.com/user-attachments/assets/cb9654ae-40ed-4ec7-9a8e-0deda4a99002" />

全体が白とびしたようになってしまうため、明るさに強弱をつけたい。

### 明るさの調整

内積で得た`specular`にべき乗をとることで、指数関数として暗い領域をより暗く見せることができる。

<img width="400" alt="スクリーンショット 2026-09-14 164527" src="https://github.com/user-attachments/assets/bf0111a8-34b5-47fc-9fa8-53bb3e42e0d9" />

```wgsl
specular = select(0.0, pow(specular, uni.shininess), specular > 0.0);
```
```ts
const settings = {
  shininess: 30,
}

const gui = new GUI().onChange(render)
gui.add(settings, 'shininess', 1, 250, 1)
```
<img width="500" alt="スクリーンショット 2026-09-14 164628" src="https://github.com/user-attachments/assets/8124435e-0aab-4240-86eb-23d6f0d89744" />

>[!NOTE]
>WGSLでは三項演算子が使用できないため`select`で代用する。\
>truthy, falsyの順番に気を付ける。
```wgsl
// GLSL
specular = specular > 0.0 ? pow(specular, uni.shininess) : 0.0;
// WGSL
specular = select(0.0, pow(specular, uni.shininess), specular > 0.0);
```

>[!CAUTION]
>`pow`関数の底に負数をとるとエラーになる。\
>`pow(-5, 2.5)`のような虚数を解釈できないため。
