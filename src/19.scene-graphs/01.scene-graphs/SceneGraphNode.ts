import { mat4, type Matrix } from './matrix'
import type { TRS } from './TRS'

export class SceneGraphNode {
  private readonly children: SceneGraphNode[] = []
  private readonly localMatrix: Matrix
  public readonly worldMatrix: Matrix
  private parent: SceneGraphNode | null = null

  constructor(
    public readonly name: string,
    private readonly source?: TRS,
  ) {
    this.localMatrix = mat4.identity()
    this.worldMatrix = mat4.identity()
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
    // ソースがある場合は、そのソースからローカル行列を更新する
    this.source?.getMatrix(this.localMatrix)

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
