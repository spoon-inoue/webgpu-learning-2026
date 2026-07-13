import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import { UnworkableCamera } from '@mod/threejs/UnworkableCamera'
import * as THREE from 'three'
import vertexShader from './triangle.vs'
import fragmentShader from './triangle.fs'
import { createResizeObserver } from '@/modules/threejs/resize'

const rand = (min = 0, max = 1) => {
  return Math.random() * (max - min) + min
}

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(new THREE.Color(0.3, 0.3, 0.3).convertSRGBToLinear())

const scene = new THREE.Scene()
const camera = new UnworkableCamera()

const geometry = new THREE.BufferGeometry()
const positions = Array.from({ length: 3 }, () => [0, 0, 0]).flat()
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

const material = new RawShaderMaterial({
  uniforms: {
    color: { value: null },
    scale: { value: null },
    offset: { value: null },
  },
  vertexShader,
  fragmentShader,
})

const kNumObjects = 100

const objectInfos = Array.from({ length: kNumObjects }, () => {
  const mesh = new THREE.Mesh(geometry, material.clone())
  mesh.material.uniforms.color.value = [rand(), rand(), rand(), 1]
  mesh.material.uniforms.offset.value = [rand(-0.9, 0.9), rand(-0.9, 0.9)]
  scene.add(mesh)

  return { mesh }
})

function render() {
  const aspect = canvas.width / canvas.height

  for (const { mesh } of objectInfos) {
    mesh.material.uniforms.scale.value = [0.5 / aspect, 0.5]
  }

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
