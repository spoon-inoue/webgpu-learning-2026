import { degToRadArray } from '@/modules/common/math'
import { mat4, type Matrix } from './matrix'
import { TRS } from './TRS'

type N3 = [number, number, number]

export class SceneGraphNode {
  public readonly children: SceneGraphNode[] = []
  private readonly localMatrix: Matrix
  public readonly worldMatrix: Matrix
  private parent: SceneGraphNode | null = null

  public readonly translation: N3
  public readonly rotation: N3
  public readonly scale: N3
  private readonly trs: TRS

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

  addChild(child: SceneGraphNode) {
    child.setParent(this)
  }

  removeChild(child: SceneGraphNode) {
    child.setParent(null)
  }

  setParent(parent: SceneGraphNode | null) {
    // 現在の親から自分を削除する
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this)
      if (ndx >= 0) this.parent.children.splice(ndx, 1)
    }
    // 新しい親に自分を追加する
    if (parent) parent.children.push(this)
    this.parent = parent
  }

  updateWorldMatrix() {
    // 初期化
    mat4.identity(this.localMatrix)

    // ローカル行列を更新する
    this.trs.set({ translation: this.translation, rotation: degToRadArray(this.rotation), scale: this.scale })
    this.trs.getMatrix(this.localMatrix)

    if (this.parent) {
      // 親がある場合は、親のworldMatrixをlocalMatrixに適用して、worldMatrixに書き込む
      mat4.multiply(this.parent.worldMatrix, this.localMatrix, this.worldMatrix)
    } else {
      // 親がない場合は、localMatrixをworldMatrixに書き込む
      mat4.copy(this.localMatrix, this.worldMatrix)
    }

    // すべての子ノードについて更新する
    this.children.forEach((child) => child.updateWorldMatrix())
  }
}
