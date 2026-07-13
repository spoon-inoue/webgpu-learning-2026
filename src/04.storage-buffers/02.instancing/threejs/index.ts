import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import { UnworkableCamera } from '@mod/threejs/UnworkableCamera'
import * as THREE from 'three'
import vertexShader from './triangle.vs'
import fragmentShader from './triangle.fs'
import { createResizeObserver } from '@/modules/threejs/resize'
import { rand } from '@/modules/common/math'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(new THREE.Color(0.3, 0.3, 0.3).convertSRGBToLinear())

const scene = new THREE.Scene()
const camera = new UnworkableCamera()

const kNumObjects = 100

// static
const staticStride = 4 + 2 // color + offset
const staticDatas = new Float32Array(staticStride * kNumObjects)
const staticDataTexture = new THREE.DataTexture(staticDatas, staticDatas.length, 1, THREE.RedFormat, THREE.FloatType)

for (let i = 0; i < kNumObjects; i++) {
  // color
  staticDatas[i * staticStride + 0] = rand()
  staticDatas[i * staticStride + 1] = rand()
  staticDatas[i * staticStride + 2] = rand()
  staticDatas[i * staticStride + 3] = 1
  // offset
  staticDatas[i * staticStride + 4] = rand(-0.9, 0.9)
  staticDatas[i * staticStride + 5] = rand(-0.9, 0.9)
}
staticDataTexture.needsUpdate = true

// changing
const changingStride = 2 // scale
const changingDatas = new Float32Array(changingStride * kNumObjects)
const changingDataTexture = new THREE.DataTexture(changingDatas, changingDatas.length, 1, THREE.RedFormat, THREE.FloatType)

//
const geometry = new THREE.BufferGeometry()
const positions = Array.from({ length: 3 }, () => [0, 0, 0]).flat()
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

const material = new RawShaderMaterial({
  uniforms: {
    staticDataMap: { value: staticDataTexture },
    changingDataMap: { value: changingDataTexture },
    kNumObjects: { value: kNumObjects },
    staticDataPx: { value: 1 / staticDatas.length },
    changingDataPx: { value: 1 / changingDatas.length },
  },
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.InstancedMesh(geometry, material, kNumObjects)
scene.add(mesh)

function render() {
  const aspect = canvas.width / canvas.height

  for (let i = 0; i < kNumObjects; i++) {
    changingDatas[i * changingStride + 0] = 0.5 / aspect
    changingDatas[i * changingStride + 1] = 0.5
  }
  changingDataTexture.needsUpdate = true

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
