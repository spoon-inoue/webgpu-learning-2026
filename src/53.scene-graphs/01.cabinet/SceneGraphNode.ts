import type { Matrix } from '@/modules/common/types'
import { mat4 } from './matrix'
import type { TRS } from './TRS'

export class SceneGraphNode {
  public readonly children: SceneGraphNode[] = []
  public readonly localMatrix: Matrix
  public readonly worldMatrix: Matrix
  private parent: SceneGraphNode | null = null

  constructor(
    public readonly name: string,
    public readonly source?: TRS,
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
    // 親から自分を削除する
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this)
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1)
      }
    }

    // 新しい親に自分を追加する
    if (parent) {
      parent.children.push(this)
    }
    this.parent = parent
  }

  updateWorldMatrix() {
    this.source?.getMatrix(this.localMatrix)

    if (this.parent) {
      mat4.multiply(this.parent.worldMatrix, this.localMatrix, this.worldMatrix)
    } else {
      mat4.copy(this.localMatrix, this.worldMatrix)
    }

    this.children.forEach((child) => {
      child.updateWorldMatrix()
    })
  }
}
