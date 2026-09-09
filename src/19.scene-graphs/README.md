# シーングラフ

https://webgpufundamentals.org/webgpu/lessons/ja/webgpu-scene-graphs.html

- シーングラフは、オブジェクト間で親子関係をつくり、`WorldMatrix`を解決するための構造
- オブジェクトは実体（描画対象）がなくてもOK

## キャビネットの例

構造を図にすると以下のようになる。

<!-- 図 -->

- `Mesh`は緑色で、描画対象のオブジェクトを示す
- `Group`は青色で、Matrixをもつオブジェクトを示す
- `Root`は赤色で、Groupと同様だが1つしか存在せず`updateWorldMatrix`を呼び出す
- これをそれぞれ`SceneGraphNode`（ノード）と呼ぶ

### 親子関係

以上の構造を作るためには、オブジェクト同士が親子関係を持つ必要がある。

#### SceneGraphNodeクラス

|メンバー|説明|
|:--|:--|
|parent|ノードはひとつの親ノードをもつ|
|children|ノードは複数の子ノードをもつ|
|setParent|対象のノードに対してparentを追加する。<br/>このとき、既にparentが設定されている場合は、そのparentの子ノードリストから対象のノードを削除し、parentを上書きする。|
|updateWorldMatrix|子要素のMatrixに親要素のMatrixを適用していく。<br/>通常`Root`ノードから呼ばれ、これによって、ノード全体のworldMatrixが全体座標系で表される。|

Three.jsでは[Object3D](https://threejs.org/docs/#Object3D)クラスがこれに該当する。

### ソース（オブジェクトの初期状態）

- オブジェクトに初期状態（TRS）を持たせるための仕組みを作る
- Blenderなどからモデルをimportした場合は、localMatrixを転写する
- localMatrixを分解してTRSをそれぞれ作成する場合、X,Y,Zそれぞれの回転角を得るには行列の`作用順番`を知る必要がある（Blenderのデフォルトは、XYZ順）

#### TRSクラス

`translation`, `rotation`, `scale`を引数に作成し、`getMatrix`でMatrixの形で取得する。

```ts
getMatrix(dst: Matrix) {
  mat4.translation(this.translation, dst)
  mat4.rotateX(dst, this.rotation[0], dst)
  mat4.rotateY(dst, this.rotation[1], dst)
  mat4.rotateZ(dst, this.rotation[2], dst)
  mat4.scale(dst, this.scale, dst)
  return dst
}
```

このクラスの場合、回転行列はXYZの作用順番で作成される。

### シーングラフの構築

#### ノードの生成

```ts
function addTRSSceneGraphNode(name: string, parent: SceneGraphNode | null, trs: TRSArgs) {
  const node = new SceneGraphNode(name, new TRS(trs))
  if (parent) node.setParent(parent)
  return node
}
```
- `trs`は、オブジェクトの初期状態

#### メッシュの生成

```ts
const meshes: Mesh[] = []

function addMesh(node: SceneGraphNode, vertices: Vertices, color: N4) {
  const mesh = { node, vertices, color }
  meshes.push(mesh)
  return mesh
}
```

- `mesh`は、描画対象のオブジェクト

#### キューブメッシュの生成

```ts
function addCubeNode(name: string, parent: SceneGraphNode | null, trs: TRSArgs, color: N4) {
  const node = addTRSSceneGraphNode(name, parent, trs)
  return addMesh(node, cubeVertices, color)
}
```

#### ルートの生成

```ts
const root = new SceneGraphNode('root')
// const root = addTRSSceneGraphNode('root', null, {})
```

- `root`は、一番親のノード

#### キャビネットの生成

```ts
function addDrawer(parent: SceneGraphNode, drawerNdx: number) {
  const drawerName = `drawer${drawerNdx}`

  const drawer = addTRSSceneGraphNode(drawerName, parent, { translation: [3, drawerNdx * kDrawerSpacing + 5, 1] })
  // add drawer box
  addCubeNode(`${drawerName}-drawer-mesh`, drawer, { scale: kDrawerSize }, kDrawerColor)
  // add drawer handle
  addCubeNode(`${drawerName}-handle-mesh`, drawer, { translation: kHandlePosition, scale: kHandleSize }, kHandleColor)
}
```

```ts
function addCabinet(parent: SceneGraphNode, cabinetNdx: number) {
  const cabinetName = `cabinet${cabinetNdx}`

  const cabinet = addTRSSceneGraphNode(cabinetName, parent, { translation: [cabinetNdx * kCabinetSpacing, 0, 0] })

  // prettier-ignore
  const kCabinetSize: N3 = [
    kDrawerSize[kWidth] + 6,
    kDrawerSpacing * kNumDrawersPerCabinet + 6,
    kDrawerSize[kDepth] + 4,
  ]

  addCubeNode(`${cabinetName}-mesh`, cabinet, { scale: kCabinetSize }, kCabinetColor)

  for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
    addDrawer(cabinet, drawerNdx)
  }
}
```

```ts
const root = new SceneGraphNode('root')

// Add cabinets
for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
  addCabinet(root, cabinetNdx)
}
```

## GUI

- ノード一覧から対象のノードを選択する
- 対象のノードのTRSコントローラーのみ表示する
- 対象のノードのTRSを変更できるようにする

```ts
const nodes: SceneGraphNode[] = []

function getNodes(node: SceneGraphNode) {
  nodes.push(node)
  node.children.forEach((child) => getNodes(child))
  return node
}
getNodes(root)

const settings = {
  cameraRotation: 0,
  nodeName: 'root',
}

const gui = new GUI().onChange(render)
gui.add(settings, 'cameraRotation', -180, 180, 1)

gui
  .add(
    settings,
    'nodeName',
    nodes.map((node) => node.name),
  )
  .name('node list')
  .onChange((name: string) => showNodeGui(name))

const nodeControllers = Object.fromEntries(
  nodes.map((node) => {
    const f = gui.addFolder(node.name).hide()

    const tf = f.addFolder('translation')
    tf.add(node.translation, 0, -100, 100, 1).name('x')
    tf.add(node.translation, 1, -100, 100, 1).name('y')
    tf.add(node.translation, 2, -100, 100, 1).name('z')

    const rf = f.addFolder('rotation')
    rf.add(node.rotation, 0, -180, 180, 1).name('x')
    rf.add(node.rotation, 1, -180, 180, 1).name('y')
    rf.add(node.rotation, 2, -180, 180, 1).name('z')

    const sf = f.addFolder('scale')
    sf.add(node.scale, 0, -10, 10, 0.1).decimals(1).name('x')
    sf.add(node.scale, 1, -10, 10, 0.1).decimals(1).name('y')
    sf.add(node.scale, 2, -10, 10, 0.1).decimals(1).name('z')

    return [node.name, f]
  }),
)

function showNodeGui(name: string) {
  Object.values(nodeControllers).forEach((c) => c.hide())
  nodeControllers[name].show()
}

showNodeGui(settings.nodeName)
```

`SceneGraphNode`について

```ts
constructor(
  public readonly name: string,
  source?: TRS,
) {
  this.localMatrix = mat4.identity()
  this.worldMatrix = mat4.identity()

  this.trs = source ?? new TRS()
  // 初期状態をコピーする
  this.translation = [...this.trs.translation] as N3
  this.rotation = [...this.trs.rotation] as N3
  this.scale = [...this.trs.scale] as N3
}

updateWorldMatrix() {
  // 初期化
  mat4.identity(this.localMatrix)

  // ローカル行列を更新する
  this.trs.set({ translation: this.translation, rotation: degToRadArray(this.rotation), scale: this.scale })
  this.trs.getMatrix(this.localMatrix)

  // ...
}
```

## アニメーション

初期TRSの保存を考える

## その他

### find関数

指定ノードとその子孫要素について特定のノードを検索する機能

```ts
find(name: string) {
  if (this.name === name) { return this; }

  for (const child of this.children) {
    const found = child.find(name);
    if (found) { return found; }
  }

  return undefined;
}
```

Three.jsのObject3Dには、[getObjectByName](https://threejs.org/docs/#Object3D.getObjectByName)がある

https://github.com/mrdoob/three.js/blob/148ef33ecb6d2502ff796d4554abd1549c95d519/src/core/Object3D.js#L930

### シーングラフを持つことは、一般的に3Dエンジンの始まり

`Unity`、`Blender`、`Unreal`、`Maya`、`3DSMax`、`Three.js`はすべてシーングラフを持っている。

### カメラもノード

Three.jsのドキュメントでは、対象のクラスが継承しているクラスを知ることができる。

<!-- 図 -->

`Camera`や`Light`もObject3D（ノード）あることがわかる。