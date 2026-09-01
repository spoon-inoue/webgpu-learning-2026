type Matrix = Float32Array | number[]

export function makeZToWMatrix(fudgeFactor: number): Matrix {
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ]
}

export const mat4 = {
  // prettier-ignore
  projection(width: number, height: number, depth: number, dst?: Matrix) {
    // Note: This matrix flips the Y axis so that 0 is at the top.
    // dst = dst || new Float32Array(16);
    // dst[ 0] = 2 / width;  dst[ 1] = 0;            dst[ 2] = 0;            dst[ 3] = 0;
    // dst[ 4] = 0;          dst[ 5] = -2 / height;  dst[ 6] = 0;            dst[ 7] = 0;
    // dst[ 8] = 0;          dst[ 9] = 0;            dst[10] = 0.5 / depth;  dst[11] = 0;
    // dst[12] = -1;         dst[13] = 1;            dst[14] = 0.5;          dst[15] = 1;
    // return dst;
    return mat4.ortho(0, width, height, 0, depth, -depth, dst);
  },

  // prettier-ignore
  perspective(fieldOfViewYInRadians: number, aspect: number, zNear: number, zFar: number, dst?: Matrix) {
    dst = dst || new Float32Array(16);

    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
    const rangeInv = 1 / (zNear - zFar);

    // prettier-ignore
    return set([
      f / aspect, 0,                       0,  0,
               0, f,                       0,  0,
               0, 0,         zFar * rangeInv, -1,
               0, 0, zNear * zFar * rangeInv,  0,
    ], dst)
  },

  // prettier-ignore
  ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, dst?: Matrix) {
    dst = dst || new Float32Array(16)

    const [l, r, b, t, n, f] = [left, right, bottom, top, near, far]

    dst[ 0] = 2 / (r - l);       dst[ 1] = 0;                 dst[ 2] = 0;           dst[ 3] = 0;
    dst[ 4] = 0;                 dst[ 5] = 2 / (t - b);       dst[ 6] = 0;           dst[ 7] = 0;
    dst[ 8] = 0;                 dst[ 9] = 0;                 dst[10] = 1 / (n - f); dst[11] = 0;
    dst[12] = (r + l) / (l - r); dst[13] = (t + b) / (b - t); dst[14] = n / (n - f); dst[15] = 1;
    return dst
  },

  // prettier-ignore
  identity(dst?: Matrix) {
    dst = dst || new Float32Array(16);
    dst[ 0] = 1;  dst[ 1] = 0;  dst[ 2] = 0;   dst[ 3] = 0;
    dst[ 4] = 0;  dst[ 5] = 1;  dst[ 6] = 0;   dst[ 7] = 0;
    dst[ 8] = 0;  dst[ 9] = 0;  dst[10] = 1;   dst[11] = 0;
    dst[12] = 0;  dst[13] = 0;  dst[14] = 0;   dst[15] = 1;
    return dst;
  },

  // prettier-ignore
  multiply(a: Matrix, b: Matrix, dst?: Matrix) {
    dst = dst || new Float32Array(16);
    const b00 = b[0 * 4 + 0];
    const b01 = b[0 * 4 + 1];
    const b02 = b[0 * 4 + 2];
    const b03 = b[0 * 4 + 3];
    const b10 = b[1 * 4 + 0];
    const b11 = b[1 * 4 + 1];
    const b12 = b[1 * 4 + 2];
    const b13 = b[1 * 4 + 3];
    const b20 = b[2 * 4 + 0];
    const b21 = b[2 * 4 + 1];
    const b22 = b[2 * 4 + 2];
    const b23 = b[2 * 4 + 3];
    const b30 = b[3 * 4 + 0];
    const b31 = b[3 * 4 + 1];
    const b32 = b[3 * 4 + 2];
    const b33 = b[3 * 4 + 3];
    const a00 = a[0 * 4 + 0];
    const a01 = a[0 * 4 + 1];
    const a02 = a[0 * 4 + 2];
    const a03 = a[0 * 4 + 3];
    const a10 = a[1 * 4 + 0];
    const a11 = a[1 * 4 + 1];
    const a12 = a[1 * 4 + 2];
    const a13 = a[1 * 4 + 3];
    const a20 = a[2 * 4 + 0];
    const a21 = a[2 * 4 + 1];
    const a22 = a[2 * 4 + 2];
    const a23 = a[2 * 4 + 3];
    const a30 = a[3 * 4 + 0];
    const a31 = a[3 * 4 + 1];
    const a32 = a[3 * 4 + 2];
    const a33 = a[3 * 4 + 3];

    dst[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    dst[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    dst[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    dst[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

    dst[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    dst[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    dst[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    dst[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

    dst[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    dst[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    dst[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    dst[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

    dst[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    dst[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    dst[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    dst[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

    return dst;
  },

  // prettier-ignore
  translation([tx, ty, tz]: [number, number, number], dst?: Matrix) {
    dst = dst || new Float32Array(16);
    dst[ 0] = 1;   dst[ 1] = 0;   dst[ 2] = 0;   dst[ 3] = 0;
    dst[ 4] = 0;   dst[ 5] = 1;   dst[ 6] = 0;   dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;   dst[10] = 1;   dst[11] = 0;
    dst[12] = tx;  dst[13] = ty;  dst[14] = tz;  dst[15] = 1;
    return dst;
  },

  // prettier-ignore
  rotationX(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = 1;  dst[ 1] = 0;   dst[ 2] = 0;  dst[ 3] = 0;
    dst[ 4] = 0;  dst[ 5] = c;   dst[ 6] = s;  dst[ 7] = 0;
    dst[ 8] = 0;  dst[ 9] = -s;  dst[10] = c;  dst[11] = 0;
    dst[12] = 0;  dst[13] = 0;   dst[14] = 0;  dst[15] = 1;
    return dst;
  },

  // prettier-ignore
  rotationY(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = c;  dst[ 1] = 0;  dst[ 2] = -s;  dst[ 3] = 0;
    dst[ 4] = 0;  dst[ 5] = 1;  dst[ 6] = 0;   dst[ 7] = 0;
    dst[ 8] = s;  dst[ 9] = 0;  dst[10] = c;   dst[11] = 0;
    dst[12] = 0;  dst[13] = 0;  dst[14] = 0;   dst[15] = 1;
    return dst;
  },

  // prettier-ignore
  rotationZ(angleInRadians: number, dst?: Matrix) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = c;   dst[ 1] = s;  dst[ 2] = 0;  dst[ 3] = 0;
    dst[ 4] = -s;  dst[ 5] = c;  dst[ 6] = 0;  dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;  dst[10] = 1;  dst[11] = 0;
    dst[12] = 0;   dst[13] = 0;  dst[14] = 0;  dst[15] = 1;
    return dst;
  },

  // prettier-ignore
  scaling([sx, sy, sz]: [number, number, number], dst?: Matrix) {
    dst = dst || new Float32Array(16);
    dst[ 0] = sx;  dst[ 1] = 0;   dst[ 2] = 0;    dst[ 3] = 0;
    dst[ 4] = 0;   dst[ 5] = sy;  dst[ 6] = 0;    dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;   dst[10] = sz;   dst[11] = 0;
    dst[12] = 0;   dst[13] = 0;   dst[14] = 0;    dst[15] = 1;
    return dst;
  },

  translate(m: Matrix, translation: [number, number, number], dst?: Matrix) {
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

  scale(m: Matrix, scale: [number, number, number], dst?: Matrix) {
    return mat4.multiply(m, mat4.scaling(scale), dst)
  },
}

function set(src: Matrix, dst: Matrix) {
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
