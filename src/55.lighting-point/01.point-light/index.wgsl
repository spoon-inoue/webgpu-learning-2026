struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
}

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) surfaceToLight: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;
  // calc position
  vsOut.position = uni.worldViewProjection * vert.position;
  // calc normal
  vsOut.normal = uni.normalMatrix * vert.normal;
  // calc light direction
  let surfaceWorldPosition = (uni.world * vert.position).xyz;
  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;
  return vsOut;
}

@fragment fn fs(fsIn: VSOut) -> @location(0) vec4f {
  let normal = normalize(fsIn.normal);
  let surfaceToLightDirection = normalize(fsIn.surfaceToLight);
  let light = dot(normal, surfaceToLightDirection);
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}