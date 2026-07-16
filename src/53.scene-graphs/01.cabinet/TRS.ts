import type { Matrix, Triple } from '@/modules/common/types'
import { mat4 } from './matrix'

export type TRSSource = {
  translation?: Triple
  rotation?: Triple
  scale?: Triple
}

export class TRS {
  public readonly translation: Float32Array
  public readonly rotation: Float32Array
  public readonly scale: Float32Array

  constructor(src?: TRSSource) {
    this.translation = new Float32Array(src?.translation ?? [0, 0, 0])
    this.rotation = new Float32Array(src?.rotation ?? [0, 0, 0])
    this.scale = new Float32Array(src?.scale ?? [1, 1, 1])
  }

  getMatrix(dst: Matrix) {
    mat4.translation(this.translation, dst)
    mat4.rotateX(dst, this.rotation[0], dst)
    mat4.rotateY(dst, this.rotation[1], dst)
    mat4.rotateZ(dst, this.rotation[2], dst)
    mat4.scale(dst, this.scale, dst)
    return dst
  }
}
