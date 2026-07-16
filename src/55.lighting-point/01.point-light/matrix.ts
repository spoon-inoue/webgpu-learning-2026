import type { Matrix, Triple, Vec3 } from '@/modules/common/types'
import { vec3 } from './vec3'

export const mat4 = {
  projection(width: number, height: number, depth: number, dst?: Matrix) {
    // Note: This matrix flips the Y axis so that 0 is at the top.
    return mat4.ortho(0, width, height, 0, depth, -depth, dst)
  },

  perspective(fieldOfViewYInRadians: number, aspect: number, zNear: number, zFar: number, dst?: Matrix) {
    dst = dst || new Float32Array(16)

    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians)
    const rangeInv = 1 / (zNear - zFar)
    // prettier-ignore
    return setMatrix(dst, [
      f / aspect, 0,                       0,  0,
               0, f,                       0,  0,
               0, 0,         zFar * rangeInv, -1,
               0, 0, zNear * zFar * rangeInv,  0,
    ])
  },

  ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, dst?: Matrix) {
    dst = dst || new Float32Array(16)
    const [r, l, t, b, n, f] = [right, left, top, bottom, near, far]
    // prettier-ignore
    return setMatrix(dst, [
            2 / (r - l),                 0,           0, 0,
                      0,       2 / (t - b),           0, 0,
                      0,                 0, 1 / (n - f), 0,
      (r + l) / (l - r), (t + b) / (b - t), n / (n - f), 1,
    ])
  },

  identity(dst?: Matrix) {
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])
  },

  multiply(a: Matrix, b: Matrix, dst?: Matrix) {
    dst = dst || new Float32Array(16)
    const b00 = b[0 * 4 + 0]
    const b01 = b[0 * 4 + 1]
    const b02 = b[0 * 4 + 2]
    const b03 = b[0 * 4 + 3]
    const b10 = b[1 * 4 + 0]
    const b11 = b[1 * 4 + 1]
    const b12 = b[1 * 4 + 2]
    const b13 = b[1 * 4 + 3]
    const b20 = b[2 * 4 + 0]
    const b21 = b[2 * 4 + 1]
    const b22 = b[2 * 4 + 2]
    const b23 = b[2 * 4 + 3]
    const b30 = b[3 * 4 + 0]
    const b31 = b[3 * 4 + 1]
    const b32 = b[3 * 4 + 2]
    const b33 = b[3 * 4 + 3]
    const a00 = a[0 * 4 + 0]
    const a01 = a[0 * 4 + 1]
    const a02 = a[0 * 4 + 2]
    const a03 = a[0 * 4 + 3]
    const a10 = a[1 * 4 + 0]
    const a11 = a[1 * 4 + 1]
    const a12 = a[1 * 4 + 2]
    const a13 = a[1 * 4 + 3]
    const a20 = a[2 * 4 + 0]
    const a21 = a[2 * 4 + 1]
    const a22 = a[2 * 4 + 2]
    const a23 = a[2 * 4 + 3]
    const a30 = a[3 * 4 + 0]
    const a31 = a[3 * 4 + 1]
    const a32 = a[3 * 4 + 2]
    const a33 = a[3 * 4 + 3]

    return setMatrix(dst, [
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,

      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,

      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,

      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
    ])
  },

  inverse(m: Matrix, dst?: Matrix) {
    dst = dst || new Float32Array(16)

    const m00 = m[0 * 4 + 0]
    const m01 = m[0 * 4 + 1]
    const m02 = m[0 * 4 + 2]
    const m03 = m[0 * 4 + 3]
    const m10 = m[1 * 4 + 0]
    const m11 = m[1 * 4 + 1]
    const m12 = m[1 * 4 + 2]
    const m13 = m[1 * 4 + 3]
    const m20 = m[2 * 4 + 0]
    const m21 = m[2 * 4 + 1]
    const m22 = m[2 * 4 + 2]
    const m23 = m[2 * 4 + 3]
    const m30 = m[3 * 4 + 0]
    const m31 = m[3 * 4 + 1]
    const m32 = m[3 * 4 + 2]
    const m33 = m[3 * 4 + 3]

    const tmp0 = m22 * m33
    const tmp1 = m32 * m23
    const tmp2 = m12 * m33
    const tmp3 = m32 * m13
    const tmp4 = m12 * m23
    const tmp5 = m22 * m13
    const tmp6 = m02 * m33
    const tmp7 = m32 * m03
    const tmp8 = m02 * m23
    const tmp9 = m22 * m03
    const tmp10 = m02 * m13
    const tmp11 = m12 * m03
    const tmp12 = m20 * m31
    const tmp13 = m30 * m21
    const tmp14 = m10 * m31
    const tmp15 = m30 * m11
    const tmp16 = m10 * m21
    const tmp17 = m20 * m11
    const tmp18 = m00 * m31
    const tmp19 = m30 * m01
    const tmp20 = m00 * m21
    const tmp21 = m20 * m01
    const tmp22 = m00 * m11
    const tmp23 = m10 * m01

    const t0 = tmp0 * m11 + tmp3 * m21 + tmp4 * m31 - (tmp1 * m11 + tmp2 * m21 + tmp5 * m31)
    const t1 = tmp1 * m01 + tmp6 * m21 + tmp9 * m31 - (tmp0 * m01 + tmp7 * m21 + tmp8 * m31)
    const t2 = tmp2 * m01 + tmp7 * m11 + tmp10 * m31 - (tmp3 * m01 + tmp6 * m11 + tmp11 * m31)
    const t3 = tmp5 * m01 + tmp8 * m11 + tmp11 * m21 - (tmp4 * m01 + tmp9 * m11 + tmp10 * m21)

    const d = 1 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3)

    return setMatrix(dst, [
      d * t0,
      d * t1,
      d * t2,
      d * t3,

      d * (tmp1 * m10 + tmp2 * m20 + tmp5 * m30 - (tmp0 * m10 + tmp3 * m20 + tmp4 * m30)),
      d * (tmp0 * m00 + tmp7 * m20 + tmp8 * m30 - (tmp1 * m00 + tmp6 * m20 + tmp9 * m30)),
      d * (tmp3 * m00 + tmp6 * m10 + tmp11 * m30 - (tmp2 * m00 + tmp7 * m10 + tmp10 * m30)),
      d * (tmp4 * m00 + tmp9 * m10 + tmp10 * m20 - (tmp5 * m00 + tmp8 * m10 + tmp11 * m20)),

      d * (tmp12 * m13 + tmp15 * m23 + tmp16 * m33 - (tmp13 * m13 + tmp14 * m23 + tmp17 * m33)),
      d * (tmp13 * m03 + tmp18 * m23 + tmp21 * m33 - (tmp12 * m03 + tmp19 * m23 + tmp20 * m33)),
      d * (tmp14 * m03 + tmp19 * m13 + tmp22 * m33 - (tmp15 * m03 + tmp18 * m13 + tmp23 * m33)),
      d * (tmp17 * m03 + tmp20 * m13 + tmp23 * m23 - (tmp16 * m03 + tmp21 * m13 + tmp22 * m23)),

      d * (tmp14 * m22 + tmp17 * m32 + tmp13 * m12 - (tmp16 * m32 + tmp12 * m12 + tmp15 * m22)),
      d * (tmp20 * m32 + tmp12 * m02 + tmp19 * m22 - (tmp18 * m22 + tmp21 * m32 + tmp13 * m02)),
      d * (tmp18 * m12 + tmp23 * m32 + tmp15 * m02 - (tmp22 * m32 + tmp14 * m02 + tmp19 * m12)),
      d * (tmp22 * m22 + tmp16 * m02 + tmp21 * m12 - (tmp20 * m12 + tmp23 * m22 + tmp17 * m02)),
    ])
  },

  transpose(m: Matrix, dst?: Matrix) {
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      m[0],  m[4],  m[8],  m[12],
      m[1],  m[5],  m[9],  m[13],
      m[2],  m[6],  m[10], m[14],
      m[3],  m[7],  m[11], m[15],
    ])
  },

  aim(eye: Vec3, target: Vec3, up: Vec3, dst?: Matrix) {
    dst = dst || new Float32Array(16)

    const zAxis = vec3.normalize(vec3.subtract(target, eye))
    const xAxis = vec3.normalize(vec3.cross(up, zAxis))
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis))

    // prettier-ignore
    return setMatrix(dst, [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
        eye[0],   eye[1],   eye[2], 1,
    ])
  },

  cameraAim(eye: Vec3, target: Vec3, up: Vec3, dst?: Matrix) {
    dst = dst || new Float32Array(16)

    const zAxis = vec3.normalize(vec3.subtract(eye, target))
    const xAxis = vec3.normalize(vec3.cross(up, zAxis))
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis))

    // prettier-ignore
    return setMatrix(dst, [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
        eye[0],   eye[1],   eye[2], 1,
    ])
  },

  lookAt(eye: Vec3, target: Vec3, up: Vec3, dst?: Matrix) {
    return mat4.inverse(mat4.cameraAim(eye, target, up, dst))
  },

  translation([tx, ty, tz]: Triple, dst?: Matrix) {
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
       1,  0,  0,  0,
       0,  1,  0,  0,
       0,  0,  1,  0,
      tx, ty, tz,  1,
    ])
  },

  rotationX(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians)
    const s = Math.sin(angleInRadians)
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      1,  0,   0,  0,
      0,  c,   s,  0,
      0, -s,   c,  0,
      0,  0,   0,  1,
    ])
  },

  rotationY(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians)
    const s = Math.sin(angleInRadians)
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      c,  0, -s,  0,
      0,  1,  0,  0,
      s,  0,  c,  0,
      0,  0,  0,  1,
    ])
  },

  rotationZ(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians)
    const s = Math.sin(angleInRadians)
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      c,  s,  0,  0,
     -s,  c,  0,  0,
      0,  0,  1,  0,
      0,  0,  0,  1,
    ])
  },

  scaling([sx, sy, sz]: Triple, dst?: Matrix) {
    dst = dst || new Float32Array(16)
    // prettier-ignore
    return setMatrix(dst, [
      sx,   0,   0,  0,
       0,  sy,   0,  0,
       0,   0,  sz,  0,
       0,   0,   0,  1,
    ])
  },

  translate(m: Matrix, translation: Triple, dst?: Matrix) {
    return mat4.multiply(m, mat4.translation(translation), dst)
  },

  rotateX(m: Matrix, angleInRadians: number, dst?: Matrix) {
    return mat4.multiply(m, mat4.rotationX(angleInRadians), dst)
  },

  rotateY(m: Matrix, angleInRadians: number, dst?: Matrix) {
    return mat4.multiply(m, mat4.rotationY(angleInRadians), dst)
  },

  rotateZ(m: Matrix, angleInRadians: number, dst?: Matrix) {
    return mat4.multiply(m, mat4.rotationZ(angleInRadians), dst)
  },

  scale(m: Matrix, scale: Triple, dst?: Matrix) {
    return mat4.multiply(m, mat4.scaling(scale), dst)
  },
}

function setMatrix(dst: Matrix, src: number[]) {
  dst[0] = src[0]
  dst[1] = src[1]
  dst[2] = src[2]
  dst[3] = src[3]
  dst[4] = src[4]
  dst[5] = src[5]
  dst[6] = src[6]
  dst[7] = src[7]
  dst[8] = src[8]
  dst[9] = src[9]
  dst[10] = src[10]
  dst[11] = src[11]
  dst[12] = src[12]
  dst[13] = src[13]
  dst[14] = src[14]
  dst[15] = src[15]
  return dst
}

//
export const mat3 = {
  fromMat4(m: Matrix, dst?: Matrix) {
    dst = dst || new Float32Array(12)

    dst[0] = m[0]
    dst[1] = m[1]
    dst[2] = m[2]
    dst[4] = m[4]
    dst[5] = m[5]
    dst[6] = m[6]
    dst[8] = m[8]
    dst[9] = m[9]
    dst[10] = m[10]

    return dst
  },
}
