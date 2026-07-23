import type { Triple } from '@/modules/common/types'

export function createCircleVertices({ radius = 1, numSubdivisions = 24, innerRadius = 0, startAngle = 0, endAngle = Math.PI * 2 }) {
  // 1つのサブディビジョンあたり、3角形（3頂点）が2つずつ
  const numVertices = numSubdivisions * 3 * 2
  // numVerticesあたり、position(float32x2), color(unorm8x4)ずつ
  const vertexData = new Float32Array(numVertices * (2 + 1))
  const colorData = new Uint8Array(vertexData.buffer)

  let offset = 0
  let colorOffset = 8
  const addVertex = (x: number, y: number, r: number, g: number, b: number) => {
    vertexData[offset++] = x
    vertexData[offset++] = y

    offset += 1 // 色をスキップ
    colorData[colorOffset++] = r * 255
    colorData[colorOffset++] = g * 255
    colorData[colorOffset++] = b * 255
    colorOffset += 9
  }

  const innerColor: Triple = [1, 1, 1]
  const outerColor: Triple = [0.1, 0.1, 0.1]

  // 1つのサブディビジョンあたり2つの三角形
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; i++) {
    const angle1 = startAngle + (i + 0) * ((endAngle - startAngle) / numSubdivisions)
    const angle2 = startAngle + (i + 1) * ((endAngle - startAngle) / numSubdivisions)

    const c1 = Math.cos(angle1)
    const s1 = Math.sin(angle1)
    const c2 = Math.cos(angle2)
    const s2 = Math.sin(angle2)

    addVertex(c1 * radius, s1 * radius, ...outerColor)
    addVertex(c2 * radius, s2 * radius, ...outerColor)
    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)

    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)
    addVertex(c2 * radius, s2 * radius, ...outerColor)
    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor)
  }

  return { vertexData, numVertices }
}
