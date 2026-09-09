import { mat4, type Matrix } from './matrix'

type N3 = [number, number, number]
export type TRSArgs = {
  translation?: N3
  rotation?: N3
  scale?: N3
}

export class TRS {
  public readonly translation: Float32Array
  public readonly rotation: Float32Array
  public readonly scale: Float32Array

  constructor(args?: TRSArgs) {
    this.translation = new Float32Array(args?.translation ?? [0, 0, 0])
    this.rotation = new Float32Array(args?.rotation ?? [0, 0, 0])
    this.scale = new Float32Array(args?.scale ?? [1, 1, 1])
  }

  getMatrix(dst: Matrix) {
    mat4.translation(this.translation, dst)
    mat4.rotateX(dst, this.rotation[0], dst)
    mat4.rotateY(dst, this.rotation[1], dst)
    mat4.rotateZ(dst, this.rotation[2], dst)
    mat4.scale(dst, this.scale, dst)
    return dst
  }

  set(trs: TRSArgs) {
    trs.translation && this.translation.set(trs.translation)
    trs.rotation && this.rotation.set(trs.rotation)
    trs.scale && this.scale.set(trs.scale)
    return this
  }
}
