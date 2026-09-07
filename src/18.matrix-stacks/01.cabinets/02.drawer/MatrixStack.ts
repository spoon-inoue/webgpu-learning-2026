import { mat4, type Matrix } from './matrix'

export class MatrixStack {
  private matrix: Matrix
  private stack: Matrix[] = []

  constructor() {
    this.matrix = mat4.identity()
    this.reset()
  }

  reset() {
    this.matrix = mat4.identity()
    this.stack = []
    return this
  }

  save() {
    this.stack.push(this.matrix)
    this.matrix = mat4.copy(this.matrix)
    return this
  }

  restore() {
    const pop = this.stack.pop()
    if (pop) this.matrix = pop
    return this
  }

  get() {
    return this.matrix
  }

  set(matrix: Matrix) {
    return mat4.copy(matrix, this.matrix)
  }

  translate(translation: [number, number, number]) {
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

  scale(scale: [number, number, number]) {
    mat4.scale(this.matrix, scale, this.matrix)
    return this
  }
}
