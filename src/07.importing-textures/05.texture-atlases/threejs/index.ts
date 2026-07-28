import { createResizeObserver } from '@/modules/threejs/resize'
import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import * as THREE from 'three'
import fragmentShader from './index.fs'
import vertexShader from './index.vs'
import { createCubeVertices } from './vertices'
import GUI from 'lil-gui'
import { degToRad } from '@/modules/common/math'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 10)
camera.position.set(0, 1, 5)
camera.lookAt(0, 0, 0) // default
camera.up.set(0, 1, 0) // default

// ======================
// texture
// ======================

const loader = new THREE.TextureLoader()

const texture = await loader.loadAsync(import.meta.env.BASE_URL + 'assets/images/noodles.jpg')
texture.flipY = false
texture.magFilter = THREE.LinearFilter
texture.minFilter = THREE.LinearMipMapLinearFilter
texture.generateMipmaps = true

// ======================
// mesh
// ======================

const { positionData, texcoordData, indexData } = createCubeVertices()

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionData, 3))
geometry.setAttribute('texcoord', new THREE.Float32BufferAttribute(texcoordData, 2))
geometry.setIndex(new THREE.Uint16BufferAttribute(indexData, 1))

const material = new RawShaderMaterial({
  uniforms: {
    map: { value: texture },
  },
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

// =============================
// settings
// =============================

const settings = {
  rotation: [20, 20, 0],
}

const gui = new GUI()
gui.add(settings.rotation, 0, -360, 360, 1).name('rotation.x')
gui.add(settings.rotation, 1, -360, 360, 1).name('rotation.y')
gui.add(settings.rotation, 2, -360, 360, 1).name('rotation.z')

gui.onChange(render)

// ======================
// render
// ======================

function render() {
  mesh.rotation.set(degToRad(settings.rotation[0]), degToRad(settings.rotation[1]), degToRad(settings.rotation[2]))

  camera.aspect = canvas.clientWidth / canvas.clientHeight
  camera.updateProjectionMatrix()

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
