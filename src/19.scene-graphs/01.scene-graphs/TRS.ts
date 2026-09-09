import { mat4, type Matrix } from './matrix'

type N3 = [number, number, number]
export type TRSArgs = {
  translation?: N3
  rotation?: N3
  scale?: N3
}

export class TRS {
  private readonly translation: Float32Array
  private readonly rotation: Float32Array
  private readonly scale: Float32Array

  constructor({ translation, rotation, scale }: TRSArgs) {
    this.translation = new Float32Array(translation ?? [0, 0, 0])
    this.rotation = new Float32Array(rotation ?? [0, 0, 0])
    this.scale = new Float32Array(scale ?? [1, 1, 1])
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
