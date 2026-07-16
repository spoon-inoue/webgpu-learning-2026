import { TRS } from './TRS'

export class TRSUIHelper {
  private trs: TRS

  constructor() {
    this.trs = new TRS()
  }

  setTRS(trs: TRS) {
    this.trs = trs
  }

  get translationX() {
    return this.trs.translation[0]
  }
  set translationX(v: number) {
    this.trs.translation[0] = v
  }
  get translationY() {
    return this.trs.translation[1]
  }
  set translationY(v: number) {
    this.trs.translation[1] = v
  }
  get translationZ() {
    return this.trs.translation[2]
  }
  set translationZ(v: number) {
    this.trs.translation[2] = v
  }

  get rotationX() {
    return this.trs.rotation[0]
  }
  set rotationX(v: number) {
    this.trs.rotation[0] = v
  }
  get rotationY() {
    return this.trs.rotation[1]
  }
  set rotationY(v: number) {
    this.trs.rotation[1] = v
  }
  get rotationZ() {
    return this.trs.rotation[2]
  }
  set rotationZ(v: number) {
    this.trs.rotation[2] = v
  }

  get scaleX() {
    return this.trs.scale[0]
  }
  set scaleX(v: number) {
    this.trs.scale[0] = v
  }
  get scaleY() {
    return this.trs.scale[1]
  }
  set scaleY(v: number) {
    this.trs.scale[1] = v
  }
  get scaleZ() {
    return this.trs.scale[2]
  }
  set scaleZ(v: number) {
    this.trs.scale[2] = v
  }
}
