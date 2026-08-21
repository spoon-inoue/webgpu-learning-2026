import { createResizeObserver } from '@/modules/threejs/resize'
import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import * as THREE from 'three'
import fragmentShader from './index.fs'
import vertexShader from './index.vs'
import GUI from 'lil-gui'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()

const half = [window.innerWidth / 2, window.innerHeight / 2]
const camera = new THREE.OrthographicCamera(-half[0], half[0], half[1], -half[1], 0.01, 10)
camera.position.z = 5

// ======================
// texture
// ======================
const loader = new THREE.TextureLoader()

const texture = await loader.loadAsync(import.meta.env.BASE_URL + 'assets/images/melting_face.png')
texture.magFilter = THREE.LinearFilter
texture.minFilter = THREE.LinearMipmapLinearFilter
texture.premultiplyAlpha = true

// ======================
// mesh
// ======================
const size = Math.min(window.innerWidth, window.innerHeight) * 0.5

const geometry = new THREE.PlaneGeometry(size, size)

const material = new RawShaderMaterial({
  uniforms: {
    map: { value: texture },
  },
  vertexShader,
  fragmentShader,
  depthWrite: false,
  blending: THREE.CustomBlending,
  // color blend
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  // alpha blend
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
})

const mesh = new THREE.Mesh(geometry, material)
mesh.position.set(70, 70, 1)
mesh.renderOrder = 1

const mesh2 = mesh.clone()
mesh2.position.set(-70, -70, -1)
mesh2.renderOrder = 0

scene.add(mesh)
scene.add(mesh2)

// ======================
// settings
// ======================
const gui = new GUI()

gui.add(texture, 'premultiplyAlpha').onChange(() => {
  texture.needsUpdate = true
  render()
})

gui.add(mesh, 'renderOrder', [-1, 1]).name('forePlane renderOrder').onChange(render)
gui.add(mesh2, 'renderOrder').disable().name('backPlane renderOrder').onChange(render)

// ======================
// render
// ======================
function render() {
  const half = [window.innerWidth / 2, window.innerHeight / 2]
  camera.left = -half[0]
  camera.right = half[0]
  camera.top = half[1]
  camera.bottom = -half[1]
  camera.updateProjectionMatrix()

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
