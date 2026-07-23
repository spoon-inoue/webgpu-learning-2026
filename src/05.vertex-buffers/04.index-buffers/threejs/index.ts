import { rand } from '@/modules/common/math'
import { RawShaderMaterial } from '@/modules/threejs/ExtendedMaterials'
import { createResizeObserver } from '@/modules/threejs/resize'
import { UnworkableCamera } from '@/modules/threejs/UnworkableCamera'
import * as THREE from 'three'
import fragmentShader from './index.fs'
import vertexShader from './index.vs'
import { createCircleVertices } from './vertices'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(new THREE.Color(0.3, 0.3, 0.3).convertSRGBToLinear())

const scene = new THREE.Scene()
const camera = new UnworkableCamera()

// ===========================
// geometry
// ===========================

const kNumObjects = 100

const geometry = new THREE.BufferGeometry()

const { vertexData, colorData, indexData } = createCircleVertices({ radius: 0.5, innerRadius: 0.25 })

geometry.setIndex(new THREE.Uint32BufferAttribute(indexData, 1))

geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexData, 3))
geometry.setAttribute('perVertexColor', new THREE.Uint8BufferAttribute(colorData, 4, true))

const colors = new Uint8Array(kNumObjects * 4)
const offsets = new Float32Array(kNumObjects * 2)
const scales = new Float32Array(kNumObjects * 2)

const objectInfos = Array.from({ length: kNumObjects }, (_, i) => {
  colors.set([rand() * 255, rand() * 255, rand() * 255, 255], i * 4)
  offsets.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], i * 2)

  return { scale: rand(0.2, 0.5) }
})

geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 4, true))
geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 2))
geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 2))

// ===========================
// material
// ===========================

const material = new RawShaderMaterial({
  uniforms: {},
  vertexShader,
  fragmentShader,
})

// ===========================
// mesh
// ===========================

const mesh = new THREE.InstancedMesh(geometry, material, kNumObjects)
scene.add(mesh)

// ===========================
// render
// ===========================

function render() {
  const aspect = canvas.width / canvas.height

  objectInfos.forEach(({ scale }, i) => {
    scales.set([scale / aspect, scale], i * 2)
  })
  geometry.getAttribute('scale').needsUpdate = true

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
