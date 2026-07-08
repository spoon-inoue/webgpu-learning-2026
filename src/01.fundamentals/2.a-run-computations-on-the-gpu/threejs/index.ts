import { RawShaderMaterial } from '@mod/threejs/ExtendedMaterials'
import { UnworkableCamera } from '@mod/threejs/UnworkableCamera'
import * as THREE from 'three'
import vertexShader from './compute.vs'
import fragmentShader from './compute.fs'

const renderer = new THREE.WebGLRenderer()

const scene = new THREE.Scene()
const camera = new UnworkableCamera()

const size = { width: 3, height: 1 }

const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
  format: THREE.RedFormat,
  type: THREE.FloatType,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
})

const input = Float32Array.from([1, 3, 5])
const dataTexture = new THREE.DataTexture(input, size.width, size.height, THREE.RedFormat, THREE.FloatType)
dataTexture.needsUpdate = true

const geometry = new THREE.PlaneGeometry(2, 2)

const material = new RawShaderMaterial({
  uniforms: {
    dataMap: { value: dataTexture },
  },
  vertexShader,
  fragmentShader,
})

const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

renderer.setRenderTarget(renderTarget)
renderer.render(scene, camera)

const result = new Float32Array(3)
renderer.readRenderTargetPixels(renderTarget, 0, 0, size.width, size.height, result)

const inputValue = document.querySelector<HTMLElement>('.log .input .value')!
const outputValue = document.querySelector<HTMLElement>('.log .output .value')!

inputValue.innerText = `[${input.join(', ')}]`
outputValue.innerText = `[${result.join(', ')}]`
