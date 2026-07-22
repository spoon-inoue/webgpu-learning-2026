import { createResizeObserver } from '@/modules/threejs/resize'
import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import * as THREE from 'three'
import fragmentShader from './index.fs'
import vertexShader from './index.vs'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!

const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(new THREE.Color(0.3, 0.3, 0.3).convertSRGBToLinear())

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 1, 2000)
camera.position.z = 2

// prettier-ignore
const createBlendedMipmap =  () => {
  const w = [255, 255, 255, 255];
  const r = [255,   0,   0, 255];
  const b = [  0,  28, 116, 255];
  const y = [255, 231,   0, 255];
  const g = [ 58, 181,  75, 255];
  const a = [ 38, 123, 167, 255];
  const data = new Uint8ClampedArray([
    w, r, r, r, r, r, r, a, a, r, r, r, r, r, r, w,
    w, w, r, r, r, r, r, a, a, r, r, r, r, r, w, w,
    w, w, w, r, r, r, r, a, a, r, r, r, r, w, w, w,
    w, w, w, w, r, r, r, a, a, r, r, r, w, w, w, w,
    w, w, w, w, w, r, r, a, a, r, r, w, w, w, w, w,
    w, w, w, w, w, w, r, a, a, r, w, w, w, w, w, w,
    w, w, w, w, w, w, w, a, a, w, w, w, w, w, w, w,
    b, b, b, b, b, b, b, b, a, y, y, y, y, y, y, y,
    b, b, b, b, b, b, b, g, y, y, y, y, y, y, y, y,
    w, w, w, w, w, w, w, g, g, w, w, w, w, w, w, w,
    w, w, w, w, w, w, r, g, g, r, w, w, w, w, w, w,
    w, w, w, w, w, r, r, g, g, r, r, w, w, w, w, w,
    w, w, w, w, r, r, r, g, g, r, r, r, w, w, w, w,
    w, w, w, r, r, r, r, g, g, r, r, r, r, w, w, w,
    w, w, r, r, r, r, r, g, g, r, r, r, r, r, w, w,
    w, r, r, r, r, r, r, g, g, r, r, r, r, r, r, w,
  ].flat());
  return { data, width: 16 };
}

const blended = createBlendedMipmap()
const blendedImageData = new ImageData(blended.data, blended.width)

const geometry = new THREE.BufferGeometry()
const positions = Array.from({ length: 6 }, () => [0, 0, 0]).flat()
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

Array.from({ length: 8 }, (_, i) => {
  const texture = new THREE.Texture(blendedImageData)
  texture.needsUpdate = true
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = i & 1 ? THREE.LinearFilter : THREE.NearestFilter

  const minLinear = Boolean(i & 2)
  const mipmapLinear = Boolean(i & 4)

  // minLinear mipmapLinear の組み合わせ
  texture.minFilter = minLinear
    ? mipmapLinear
      ? THREE.LinearMipmapLinearFilter // true ture
      : THREE.LinearMipmapNearestFilter // true false
    : mipmapLinear
      ? THREE.NearestMipmapLinearFilter // false true
      : THREE.NearestMipmapNearestFilter // false false

  texture.needsUpdate = true

  const material = new RawShaderMaterial({
    uniforms: {
      map: { value: texture },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)

  const xSpacing = 1.2
  const ySpacing = 0.7
  const zDepth = 50

  const x = (i % 4) - 1.5
  const y = i < 4 ? 1 : -1

  const transform = new THREE.Matrix4().identity()
  const temp = new THREE.Matrix4()

  transform.multiply(temp.makeTranslation(x * xSpacing, y * ySpacing, -zDepth * 0.5))
  transform.multiply(temp.makeRotationX(0.5 * Math.PI))
  transform.multiply(temp.makeScale(1, zDepth * 2, 1))
  transform.multiply(temp.makeTranslation(-0.5, -0.5, 0))

  mesh.matrixAutoUpdate = false
  mesh.matrix.multiply(transform)
  mesh.matrixWorldNeedsUpdate = true

  scene.add(mesh)
})

function render() {
  camera.aspect = canvas.clientWidth / canvas.clientHeight
  camera.updateProjectionMatrix()

  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

createResizeObserver(renderer, render).observe(canvas)
