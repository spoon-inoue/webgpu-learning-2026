export function createCubeVertices() {
  // prettier-ignore
  const positions = [
    // left
    0, 0,  0,
    0, 0, -1,
    0, 1,  0,
    0, 1, -1,

    // right
    1, 0,  0,
    1, 0, -1,
    1, 1,  0,
    1, 1, -1,
  ]
  // prettier-ignore
  const indices = [
     0,  2,  1,    2,  3,  1,   // left
     4,  5,  6,    6,  5,  7,   // right
     0,  4,  2,    2,  4,  6,   // front
     1,  3,  5,    5,  3,  7,   // back
     0,  1,  4,    4,  1,  5,   // bottom
     2,  6,  3,    3,  6,  7,   // top
  ]
  // prettier-ignore
  const quadColors = [
      200,  70, 120,  // left column front
       80,  70, 200,  // left column back
       70, 200, 210,  // top
      160, 160, 220,  // top rung right
       90, 130, 110,  // top rung bottom
      200, 200,  70,  // between top and middle rung
  ]

  const numVertices = indices.length
  const vertexData = new Float32Array(numVertices * 4) // xyz + color
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

/**
 * 円錐（コーン）\
 * 先端は原点にあり、底面は下にあります
 * @param param0
 * @returns
 */
export function createConeVertices({ radius = 1, height = 1, subdivisions = 6 } = {}) {
  const positions: number[] = []
  const colors: number[] = []

  function addVertex(angle: number, radius: number, height: number, color: [number, number, number]) {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    positions.push(c * radius, height, s * radius)
    colors.push(...color)
  }

  for (let i = 0; i < subdivisions; ++i) {
    const angle0 = ((i + 0) / subdivisions) * Math.PI * 2
    const angle1 = ((i + 1) / subdivisions) * Math.PI * 2

    const u = (i + 1) / subdivisions
    const color: [number, number, number] = [u * 128 + 127, 0, 0]

    // 側面を追加します
    addVertex(angle0, 0, 0, color)
    addVertex(angle1, radius, -height, color)
    addVertex(angle0, radius, -height, color)

    // 上面を追加します
    addVertex(angle0, radius, -height, color)
    addVertex(angle1, radius, -height, color)
    addVertex(angle0, 0, -height, color)
  }

  const numVertices = positions.length / 3
  const vertexData = new Float32Array(numVertices * 4) // xyz + color
  const colorData = new Uint8Array(vertexData.buffer)

  for (let i = 0; i < numVertices; ++i) {
    const position = positions.slice(i * 3, i * 3 + 3)
    vertexData.set(position, i * 4)

    const color = colors.slice(i * 3, i * 3 + 3)
    colorData.set(color, i * 16 + 12)
    colorData[i * 16 + 15] = 255
  }

  return {
    vertexData,
    numVertices,
  }
}
