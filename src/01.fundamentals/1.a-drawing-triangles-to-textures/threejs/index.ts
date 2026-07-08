import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import { UnworkableCamera } from '@mod/threejs/UnworkableCamera'
import * as THREE from 'three'
import vertexShader from './triangle.vs'
import fragmentShader from './triangle.fs'
import { createResizeObserver } from '@/modules/threejs/resize'

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
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

function render() {
  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
