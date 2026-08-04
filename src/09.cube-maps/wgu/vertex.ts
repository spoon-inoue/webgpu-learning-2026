export function createCubeVertices() {
  // prettier-ignore
  const vertexData = new Float32Array([
     // front face
    -1,  1,  1,
    -1, -1,  1,
     1,  1,  1,
     1, -1,  1,
     // right face
     1,  1, -1,
     1,  1,  1,
     1, -1, -1,
     1, -1,  1,
     // back face
     1,  1, -1,
     1, -1, -1,
    -1,  1, -1,
    -1, -1, -1,
    // left face
    -1,  1,  1,
    -1,  1, -1,
    -1, -1,  1,
    -1, -1, -1,
    // bottom face
     1, -1,  1,
    -1, -1,  1,
     1, -1, -1,
    -1, -1, -1,
    // top face
    -1,  1,  1,
     1,  1,  1,
    -1,  1, -1,
     1,  1, -1,
  ])

  // prettier-ignore
  const indexData = new Uint16Array([
     0,  1,  2,  2,  1,  3,  // front
     4,  5,  6,  6,  5,  7,  // right
     8,  9, 10, 10,  9, 11,  // back
    12, 13, 14, 14, 13, 15,  // left
    16, 17, 18, 18, 17, 19,  // bottom
    20, 21, 22, 22, 21, 23,  // top
  ])

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  }
}
