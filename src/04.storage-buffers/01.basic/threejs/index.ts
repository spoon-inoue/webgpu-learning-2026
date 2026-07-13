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
const stride = 4 + 2 + 2 // color + offset + scale

const datas = new Float32Array(stride * kNumObjects)
const dataTexture = new THREE.DataTexture(datas, datas.length, 1, THREE.RedFormat, THREE.FloatType)

const geometry = new THREE.BufferGeometry()
const positions = Array.from({ length: 3 }, () => [0, 0, 0]).flat()
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

const material = new RawShaderMaterial({
  uniforms: {
    dataMap: { value: dataTexture },
    dataOffset: { value: null },
    dataPx: { value: 1 / datas.length },
  },
  vertexShader,
  fragmentShader,
})

for (let i = 0; i < kNumObjects; i++) {
  // color
  datas[i * stride + 0] = rand()
  datas[i * stride + 1] = rand()
  datas[i * stride + 2] = rand()
  datas[i * stride + 3] = 1
  // offset
  datas[i * stride + 4] = rand(-0.9, 0.9)
  datas[i * stride + 5] = rand(-0.9, 0.9)

  const mesh = new THREE.Mesh(geometry, material.clone())
  mesh.material.uniforms.dataOffset.value = i / kNumObjects

  scene.add(mesh)
}
dataTexture.needsUpdate = true

function render() {
  const aspect = canvas.width / canvas.height

  for (let i = 0; i < kNumObjects; i++) {
    datas[i * stride + 6] = 0.5 / aspect
    datas[i * stride + 7] = 0.5
  }
  dataTexture.needsUpdate = true

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
