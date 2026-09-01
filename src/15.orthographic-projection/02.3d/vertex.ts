export function createFVertices() {
  // prettier-ignore
  const positions = [
    // left column
    0, 0, 0,
    30, 0, 0,
    0, 150, 0,
    30, 150, 0,

    // top rung
    30, 0, 0,
    100, 0, 0,
    30, 30, 0,
    100, 30, 0,

    // middle rung
    30, 60, 0,
    70, 60, 0,
    30, 90, 0,
    70, 90, 0,

    // left column back
    0, 0, 30,
    30, 0, 30,
    0, 150, 30,
    30, 150, 30,

    // top rung back
    30, 0, 30,
    100, 0, 30,
    30, 30, 30,
    100, 30, 30,

    // middle rung back
    30, 60, 30,
    70, 60, 30,
    30, 90, 30,
    70, 90, 30,
  ]

  // prettier-ignore
  const indices = [
    // front
    0,  1,  2,    2,  1,  3,  // left column
    4,  5,  6,    6,  5,  7,  // top rung
    8,  9, 10,   10,  9, 11,  // middle rung

    // back
    12,  13,  14,   14, 13, 15,  // left column back
    16,  17,  18,   18, 17, 19,  // top rung back
    20,  21,  22,   22, 21, 23,  // middle rung back

    0, 5, 12,   12, 5, 17,   // top
    5, 7, 17,   17, 7, 19,   // top rung right
    6, 7, 18,   18, 7, 19,   // top rung bottom
    6, 8, 18,   18, 8, 20,   // between top and middle rung
    8, 9, 20,   20, 9, 21,   // middle rung top
    9, 11, 21,  21, 11, 23,  // middle rung right
    10, 11, 22, 22, 11, 23,  // middle rung bottom
    10, 3, 22,  22, 3, 15,   // stem right
    2, 3, 14,   14, 3, 15,   // bottom
    0, 2, 12,   12, 2, 14,   // left
  ]

  // prettier-ignore
  const quadColors = [
      200,  70, 120,  // left column front
      200,  70, 120,  // top rung front
      200,  70, 120,  // middle rung front

       80,  70, 200,  // left column back
       80,  70, 200,  // top rung back
       80,  70, 200,  // middle rung back

       70, 200, 210,  // top
      160, 160, 220,  // top rung right
       90, 130, 110,  // top rung bottom
      200, 200,  70,  // between top and middle rung
      210, 100,  70,  // middle rung top
      210, 160,  70,  // middle rung right
       70, 180, 210,  // middle rung bottom
      100,  70, 210,  // stem right
       76, 210, 100,  // bottom
      140, 210,  80,  // left
  ]

  const numVertices = indices.length
  const vertexData = new Float32Array(numVertices * 4) // xyz + color
  vertexData.fill(-1)
  const colorData = new Uint8Array(vertexData.buffer)
  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3
    const position = positions.slice(positionNdx, positionNdx + 3)
    vertexData.set(position, i * 4)

    const quadNdx = ((i / 6) | 0) * 3
    const color = quadColors.slice(quadNdx, quadNdx + 3)
    colorData.set(color, i * 16 + 12)
    colorData[i * 16 + 15] = 255
  }

  return {
    vertexData,
    numVertices,
  }
}
