export function rand(min = 0, max = 1) {
  return Math.random() * (max - min) + min
}

export function degToRad(d: number) {
  return d * (Math.PI / 180)
}

export function degToRadArray(v: [number, number, number]): [number, number, number] {
  return [degToRad(v[0]), degToRad(v[1]), degToRad(v[2])]
}

export function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v))
}

export function saturate(v: number) {
  clamp(0, 1, v)
}
