export function rand(min = 0, max = 1) {
  return Math.random() * (max - min) + min
}

export function degToRad(d: number) {
  return d * (Math.PI / 180)
}
