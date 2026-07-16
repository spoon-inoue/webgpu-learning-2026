import type { Matrix, Triple, Vec3 } from '@/modules/common/types'
import { mat4 } from './matrix'

export class MatrixStack {
  private matrix: Matrix
  private stack: Matrix[] = []

  constructor() {
    this.matrix = mat4.identity()
  }

  reset() {
    this.matrix = mat4.identity()
    this.stack.length = 0
    return this
  }

  save() {
    this.stack.push(this.matrix)
    this.matrix = mat4.copy(this.matrix)
    return this
  }

  restore() {
    const m = this.stack.pop()
    m && (this.matrix = m)
    return this
  }

  get() {
    return this.matrix
  }

  set(matrix: Matrix) {
    this.matrix.set(matrix)
    return this
  }

  translate(translation: Triple) {
    mat4.translate(this.matrix, translation, this.matrix)
    return this
  }

  rotateX(angle: number) {
    mat4.rotateX(this.matrix, angle, this.matrix)
    return this
  }

  rotateY(angle: number) {
    mat4.rotateY(this.matrix, angle, this.matrix)
    return this
  }

  rotateZ(angle: number) {
    mat4.rotateZ(this.matrix, angle, this.matrix)
    return this
  }

  scale(scale: Triple) {
    mat4.scale(this.matrix, scale, this.matrix)
    return this
  }
}
